const amqp = require("amqplib");

let connection = null;
let channel = null;

const connectRabbitMQ = async () => {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();

    // Create email queue
    await channel.assertQueue(process.env.RABBITMQ_EMAIL_QUEUE, {
      durable: true,
    });

    // Create analytics queue
    await channel.assertQueue(process.env.RABBITMQ_ANALYTICS_QUEUE, {
      durable: true,
    });

    console.log("Connected to RabbitMQ");

    return { connection, channel };
  } catch (error) {
    console.error("Error connecting to RabbitMQ:", error);
    process.exit(1);
  }
};

const publishToQueue = async (queueName, data) => {
  try {
    if (!channel) {
      // If channel not initialized, connect first
      await connectRabbitMQ();
    }

    return channel.sendToQueue(queueName, Buffer.from(JSON.stringify(data)), {
      persistent: true,
    });
  } catch (error) {
    console.error(`Error publishing to queue ${queueName}:`, error);
    throw error;
  }
};

const consumeFromQueue = async (queueName, callback) => {
  try {
    if (!channel) {
      throw new Error("RabbitMQ channel not initialized");
    }

    return channel.consume(queueName, (msg) => {
      if (msg) {
        const data = JSON.parse(msg.content.toString());
        callback(data);
        channel.ack(msg);
      }
    });
  } catch (error) {
    console.error(`Error consuming from queue ${queueName}:`, error);
    throw error;
  }
};

const closeConnection = async () => {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
    console.log("RabbitMQ connection closed");
  } catch (error) {
    console.error("Error closing RabbitMQ connection:", error);
  }
};

process.on("SIGINT", async () => {
  await closeConnection();
  process.exit(0);
});

module.exports = {
  connectRabbitMQ,
  publishToQueue,
  consumeFromQueue,
  closeConnection,
};
