import * as cdk from '@aws-cdk/core';
import { LayerConstruct } from './constructs/layerConstruct';
// import * as sqs from '@aws-cdk/aws-sqs';

interface VinceLiveInfraLambdaLayersStackProps extends cdk.StackProps {
    branchName: string;
}

export class VinceLiveInfraLambdaLayersStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: VinceLiveInfraLambdaLayersStackProps) {
        super(scope, id, props);
        const branchName = props.branchName;


        new LayerConstruct(this, {
            branchName,
            name: 'vincelive-internal',
            description: 'Contains all relevant @vincesoftware/* npm packages'
        });

    }
}
