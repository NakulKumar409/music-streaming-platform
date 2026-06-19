import { Queue } from "bullmq";



export const uploadQueue = new Queue("media-upload", {

  connection: {

    host: "127.0.0.1",

    port: 6379,

  },

});

