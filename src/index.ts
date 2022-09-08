import cron from "node-cron";
import { load as cheerioLoad } from "cheerio";
import axios from "axios";
import ejs from "ejs";
import path from "path";
import ago from "s-ago";
import prisma from "../prisma/prisma";
import { sendEmail } from "./mail";

interface Job {
  id: string;
  title: string;
  company: string;
  logoUrl?: string;
  link: string;
  time?: Date;
  age: string | "N/A";
}

async function fetchLatestJobs(url: string): Promise<Job[]> {
  const jobs: Job[] = [];

  // Fetch
  const { data: html } = await axios.get<string>(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36",
    },
  });
  const $ = cheerioLoad(html);

  $("#jobsboard > tbody > tr").each((i, tr) => {
    const row = $(tr);
    const id = row.attr("id");
    if (id && id.startsWith("job-")) {
      // this is a job entry
      const jobId = row.attr("data-id")!;
      const jobInfo = row.find("td.company_and_position");
      const companyName = jobInfo
        .find("span>h3")
        .text()
        .replace("\n", "")
        .trim();
      const role = jobInfo.find("a>h2").text().replace("\n", "").trim();
      const link = `https://remoteok.com/remote-jobs/${jobId}`;
      const logo = row.find(".image.has-logo>a>img").attr("data-src");
      const time = row.find(".time>time").attr("datetime");

      jobs.push({
        id: jobId,
        company: companyName,
        title: role,
        link,
        logoUrl: logo,
        time: time ? new Date(time) : undefined,
        age: time ? ago(new Date(time)) : "N/A",
      });
    }
  });

  return jobs;
}

async function createEmailBody(jobs: Job[], source: string) {
  return ejs.renderFile(
    path.join(__dirname, "email.ejs"),
    { jobs, source },
    { async: true }
  );
}

async function filterUnseenJobs(jobs: Job[]): Promise<Job[]> {
  const seenJobs = await prisma.seen_jobs.findMany({
    where: {
      id: {
        in: jobs.map((j) => j.id),
      },
    },
  });

  // return unseen jobs
  const unseenJobs = jobs.filter((job) => {
    return !seenJobs.find((j2) => j2.id === job.id);
  });

  // Insert the unseen jobs
  const result = await Promise.allSettled(
    unseenJobs.map((job) =>
      prisma.seen_jobs.create({
        data: { id: job.id },
      })
    )
  );

  // Check failures
  result.forEach((result) => {
    if (result.status === "rejected") {
      console.error(result.reason);
    }
  });

  // Return the jobs
  return unseenJobs;
}

const main = async () => {
  const url =
    "https://remoteok.com/remote-javascript-jobs?location=Worldwide&min_salary=60000&order_by=date";
  const jobs = await fetchLatestJobs(url);

  const newjobs = await filterUnseenJobs(jobs);
  console.log(`${newjobs.length} new jobs found!`);

  if (newjobs.length > 0) {
    const html = await createEmailBody(newjobs, url);

    await sendEmail({
      from: {
        name: "RemoteOK Bot",
        address: "hello@snehanshu.com",
      },
      to: "snehanshuphukan@gmail.com",
      subject: `${newjobs.length} new jobs found on RemoteOK`,
      html,
    });
  }
};

if (process.env.NODE_ENV === "production") {
  cron.schedule("0 0 11 * * *", main);
  console.log("RemoteOK bot schedule running...");
} else {
  main();
  console.log("RemoteOK bot ran once...");
}
