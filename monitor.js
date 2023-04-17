const { PrismaClient } = require("@prisma/client");
const cron = require("node-cron");
const nodemailer = require("nodemailer");

const client = new PrismaClient();

const getOverdueTodos = async () => {
  const todos = await client.reminder.findMany({
    where: {
      isDone: false,
    },
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });
  console.log("todos", todos);
  return todos;
};

const sendNotification = async (todo) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: `${process.env.MY_EMAIL}`,
      pass: `${process.env.MY_PASS}`,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
  const mailOptions = {
    from: `${process.env.MY_EMAIL}`,
    to: todo.user.email,
    subject: `Reminder: [${todo.title}]`,
    text: `Message: \n Hello, \n\n This is a friendly reminder that you have a task to complete: [${todo.title}]. Please complete this task as soon as possible. \n\n Thank you, \n\n meetly-omega.vercel.app`,
  };
  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    throw new Error(error);
  }
};

const task = cron.schedule("*/10 * * * *", async () => {
  const overdueTodos = await getOverdueTodos();
  for (const todo of overdueTodos) {
    if (
      !todo.notificationSent &&
      Math.floor(Date.now() / 1000) + 600 >= todo.time
    ) {
      sendNotification(todo);
      await client.reminder.update({
        where: {
          id: todo.id,
        },
        data: {
          notificationSent: true,
        },
      });
    }
    if (!todo.isDone && todo.time <= Math.floor(Date.now() / 1000)) {
      await client.reminder.update({
        where: {
          id: todo.id,
        },
        data: {
          isDone: true,
        },
      });
    }
  }
});

task.start();
