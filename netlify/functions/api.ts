import type { Handler } from '@netlify/functions';
import serverless from 'serverless-http';
import { createApiApp } from '../../server/app.ts';

const app = createApiApp();
const serverlessHandler = serverless(app);

export const handler: Handler = async (event, context) => {
  return (await serverlessHandler(event, context)) as any;
};
