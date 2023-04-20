const cron = require("node-cron");
const { transporter } = require("./nodemailer");
const { PrismaClient } = require("@prisma/client");
const client = new PrismaClient();

const createScheduleExpression = (date) => {
  const minutes = date.getMinutes();
  const hours = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1;
  const dayOfWeek = date.getDay();

  const cronExpression = `${minutes} ${hours} ${dayOfMonth} ${month} ${dayOfWeek}`;
  return cronExpression;
};

const UnixToTimeString = (time, offset) => {
  const unixTimestamp = time * 1000;
  const date = new Date(unixTimestamp - offset);
  const timeString = date.toLocaleTimeString("en-US", {
    timeZone: "Europe/Istanbul",
    hour12: false,
  });
  return timeString;
};

const dateFromString = (dateString, timeString) => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0"); // add zero-padding to month
  const day = date.getDate().toString().padStart(2, "0"); // add zero-padding to day
  const formattedDate = `${year}-${month}-${day}`;
  const scheduledTime = new Date(`${formattedDate}T${timeString}`);
  console.log(scheduledTime);
  return scheduledTime;
};

const createSchedule = (dateString, time, offset = 0) => {
  const timeToTimeString = UnixToTimeString(time, offset);
  const scheduledTime = dateFromString(dateString, timeToTimeString);
  const cronSchedule = createScheduleExpression(scheduledTime);
  return cronSchedule;
};

const createCronJob = async (todo) => {
  const cronSchedule = createSchedule(todo.date, todo.unix, 600000);
  console.log(cronSchedule);

  cron.schedule(cronSchedule, async () => {
    await client.reminder.update({
      where: {
        id: todo.id,
      },
      data: {
        notificationSent: true,
      },
    });
    const mailOptions = {
      from: `${process.env.MY_EMAIL}`,
      to: todo.user.email,
      subject: `Reminder: [${todo.title}]`,
      text: `Message: \n Hello, \n\n This is a friendly reminder that you have a task to complete: [${todo.title}]. Please complete this task as soon as possible. \n\n Thank you, \n\n meetly-omega.vercel.app`,
    };
    await transporter.sendMail(mailOptions);
  });
};

const createCronJobToMarkAsDone = async (todo) => {
  const cronSchedule = createSchedule(todo.date, todo.unix);
  console.log(cronSchedule);

  cron.schedule(cronSchedule, async () => {
    await client.reminder.update({
      where: {
        id: todo.id,
      },
      data: {
        isDone: true,
      },
    });
  });
};

module.exports = { createCronJob, createCronJobToMarkAsDone };
