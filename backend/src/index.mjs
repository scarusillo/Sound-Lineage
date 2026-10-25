import { makeApp } from "./app.mjs";
import { dynamoStore } from "./dynamo.mjs";
export const handler = makeApp(dynamoStore(process.env.TABLE));
