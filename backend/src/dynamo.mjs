// DynamoDB storage for app.mjs (AWS SDK v3 ships with the Lambda Node.js 20 runtime).
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, QueryCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";

export function dynamoStore(TableName) {
  const c = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
  return {
    async get(PK, SK) { return (await c.send(new GetCommand({ TableName, Key: { PK, SK } }))).Item || null; },
    async put(item) { await c.send(new PutCommand({ TableName, Item: item })); },
    async del(PK, SK) { await c.send(new DeleteCommand({ TableName, Key: { PK, SK } })); },
    async query(pk, prefix, { index, limit = 100, desc = false } = {}) {
      const [P, S] = index ? ["GSI1PK", "GSI1SK"] : ["PK", "SK"];
      const r = await c.send(new QueryCommand({ TableName, IndexName: index, KeyConditionExpression: prefix ? "#p = :p AND begins_with(#s, :s)" : "#p = :p", ExpressionAttributeNames: prefix ? { "#p": P, "#s": S } : { "#p": P }, ExpressionAttributeValues: prefix ? { ":p": pk, ":s": prefix } : { ":p": pk }, ScanIndexForward: !desc, Limit: limit }));
      return r.Items || [];
    },
    async batchDocs(pks) {
      const out = [];
      for (let i = 0; i < pks.length; i += 100) {
        const keys = pks.slice(i, i + 100).map((PK) => ({ PK, SK: "PROFILE" }));
        if (!keys.length) continue;
        const r = await c.send(new BatchGetCommand({ RequestItems: { [TableName]: { Keys: keys } } }));
        for (const it of r.Responses?.[TableName] || []) out.push(it.doc);
      }
      return out;
    },
  };
}
