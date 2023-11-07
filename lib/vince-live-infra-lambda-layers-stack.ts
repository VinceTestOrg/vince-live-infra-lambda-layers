import { LayerConstruct } from './constructs/layerConstruct';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from '@aws-cdk/aws-sqs';

interface VinceLiveInfraLambdaLayersStackProps extends StackProps {
    branchName: string;
}

export class VinceLiveInfraLambdaLayersStack extends Stack {
    constructor(scope: Construct, id: string, props: VinceLiveInfraLambdaLayersStackProps) {
        super(scope, id, props);
        const branchName = props.branchName;


        new LayerConstruct(this, {
            branchName,
            name: 'vincelive-internal-test',
            description: 'Contains all relevant @vincesoftware/* npm packages'
        });

    }
}
