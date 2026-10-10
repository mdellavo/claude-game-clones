// Leaderboard API, served from a Lambda Function URL.
//
//   GET  ?game=<folder>               -> { scores: [{ name, score, at }, ...] }   (best first)
//   POST { game, name, score }        -> { rank, scores }   (rank is null if the score missed the board)
//
// Each game is one DynamoDB item holding its top scores, so a read is a single GetItem and
// the table never grows. Writes use a version check so two simultaneous submits cannot
// overwrite each other. CORS is handled by the Function URL config, not here.

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE = process.env.TABLE;
const GAMES = new Set((process.env.GAMES || '').split(',').filter(Boolean));
// Games scored by a time or count where the smallest number wins.
const LOWER_IS_BETTER = new Set((process.env.LOWER_IS_BETTER || '').split(',').filter(Boolean));
const MAX_SCORE = Number(process.env.MAX_SCORE) || 1e9;
const TOP = 50;
const NAME_LEN = 12;
const MAX_BODY = 1024;
const RETRIES = 5;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  body: JSON.stringify(body),
});

async function load(game, consistent) {
  const { Item } = await db.send(new GetCommand({ TableName: TABLE, Key: { game }, ConsistentRead: consistent }));
  return Item || { game, version: 0, scores: [] };
}

// Printable ASCII only, minus the characters that matter in HTML, so a name is safe even in
// a client that forgets to escape it.
function cleanName(name) {
  const s = String(name ?? '').replace(/[^\x20-\x7E]/g, '').replace(/[<>&"'`]/g, '').trim().slice(0, NAME_LEN);
  return s || 'ANON';
}

function parseBody(event) {
  let raw = event.body || '';
  if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8');
  if (raw.length > MAX_BODY) return null;
  try {
    const body = JSON.parse(raw);
    return body && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
}

async function submit(game, name, score) {
  const entry = { name, score, at: Date.now() };
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    const item = await load(game, true);
    // Best score first; on a tie the earlier submission keeps its place.
    const dir = LOWER_IS_BETTER.has(game) ? 1 : -1;
    const scores = [...item.scores, entry].sort((a, b) => dir * (a.score - b.score) || a.at - b.at).slice(0, TOP);
    const rank = scores.indexOf(entry) + 1;
    if (!rank) return json(200, { rank: null, scores: item.scores });
    try {
      await db.send(new PutCommand({
        TableName: TABLE,
        Item: { game, version: item.version + 1, scores },
        ConditionExpression: 'attribute_not_exists(#v) OR #v = :v',
        ExpressionAttributeNames: { '#v': 'version' },
        ExpressionAttributeValues: { ':v': item.version },
      }));
      return json(200, { rank, scores });
    } catch (err) {
      if (err.name !== 'ConditionalCheckFailedException') throw err;
    }
  }
  return json(503, { error: 'busy, try again' });
}

export async function handler(event) {
  const method = event.requestContext?.http?.method;

  if (method === 'GET') {
    const game = event.queryStringParameters?.game;
    if (!GAMES.has(game)) return json(400, { error: 'unknown game' });
    const item = await load(game, false);
    return json(200, { scores: item.scores });
  }

  if (method === 'POST') {
    const body = parseBody(event);
    if (!body) return json(400, { error: 'bad request body' });
    if (!GAMES.has(body.game)) return json(400, { error: 'unknown game' });
    if (!Number.isSafeInteger(body.score) || body.score < 0 || body.score > MAX_SCORE) {
      return json(400, { error: 'bad score' });
    }
    return submit(body.game, cleanName(body.name), body.score);
  }

  return json(405, { error: 'method not allowed' });
}
