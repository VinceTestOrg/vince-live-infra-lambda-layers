#!/usr/bin/env node
import 'source-map-support/register';
import { VinceLiveInfraLambdaLayersStack } from '../lib/vince-live-infra-lambda-layers-stack';
import { App } from 'aws-cdk-lib';

const app = new App();

const branchName = process.env.STAGE || process.env.SELECTED_BRANCH;

if (!branchName) {
    throw new Error('process.env.STAGE or process.env.SELECTED_BRANCH must be set!');
}

new VinceLiveInfraLambdaLayersStack(app, branchName + '-VinceLiveInfraLambdaLayersStack', {
    branchName,
    env: {
        region: process.env.AWS_REGION
    },
});
