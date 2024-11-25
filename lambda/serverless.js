import './shims.js';
import { Server } from '../index.js';
import { manifest } from '../manifest.js';
import { split_headers } from './headers.js';

const server = new Server(manifest);
const init = server.init({ env: process.env });

export async function handler(event) {
  const { path, method } = getVersionRoute[event.version ?? '1.0']?.(event);
  const queryString = getVersionQueryString[event.version ?? '1.0']?.(event);
  const { headers, body, isBase64Encoded } = event;
  const encoding = isBase64Encoded ? 'base64' : (headers && headers['content-encoding']) || 'utf-8';
  const rawBody = typeof body === 'string' ? Buffer.from(body, encoding) : body;
  headers.origin = process.env.ORIGIN ?? headers.origin ?? `https://${event.requestContext.domainName}`;
  const rawURL = `${headers.origin}${path}${queryString}`;

  await init;

  console.log("Using local fixed version");

  const rendered = await server.respond(
    new Request(rawURL, {
      method,
      headers: new Headers(headers || {}),
      body: rawBody,
    }),
    {
      getClientAddress() {
        return headers.get('x-forwarded-for');
      },
    }
  );


  if (rendered) {
    const resp = {
      ...split_headers(rendered.headers),
      body: await rendered.text(),
      statusCode: rendered.status,
    };

    console.log('response:');
    console.log(resp)
    resp.headers['cache-control'] = 'no-cache';
    return resp;
  }

  return {
    statusCode: 404,
    body: 'Not found.',
  };
}

const getVersionRoute = {
  '1.0': (event) => ({
    method: event.httpMethod,
    path: event.path,
  }),
  '2.0': (event) => ({
    method: event.requestContext.http.method,
    path: event.requestContext.http.path,
  }),
};

const getVersionQueryString = {
  '1.0': (event) => parseQuery(event.multiValueQueryStringParameters),
  '2.0': (event) => event.rawQueryString && '?' + event.rawQueryString,
};

function parseQuery(queryParams) {
  if (!queryParams) return '';
  let queryString = '?';

  for (let queryParamKey in queryParams) {
    for (let queryParamValue of queryParams[queryParamKey]) {
      if (queryString != '?') {
        queryString += '&';
      }
      queryString += `${queryParamKey}=${queryParamValue}`;
    }
  }
  return queryString;
}
