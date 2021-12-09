#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { VinceLiveInfraLambdaLayersStack } from '../lib/vince-live-infra-lambda-layers-stack';

const app = new cdk.App();

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
