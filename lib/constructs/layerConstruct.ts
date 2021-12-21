import { Architecture, Code, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';


interface LayerConstructProps {
    branchName: string;
    description?: string;
    name: string;
    folderName?: string;
    compatibleArchitectures?: Architecture[];
    compatibleRuntimes?: Runtime[];
}

/**
 * Creates a lambda layer and adds it's ARN to SSM /{env}/lambda-layers/{name}
 */
export class LayerConstruct extends Construct {
    constructor(scope: Construct, props: LayerConstructProps) {
        const id = `${props.branchName}-layerConstruct-${props.name}`;
        super(scope, id);

        const folderName = props.folderName ?? props.name;
        const layer = new LayerVersion(this, props.branchName + '-' + props.name, {
            layerVersionName: props.name,
            code: Code.fromAsset(`./src/layers/${folderName}`),
            compatibleArchitectures: props.compatibleArchitectures ?? [ Architecture.ARM_64, Architecture.X86_64 ],
            compatibleRuntimes: props.compatibleRuntimes ?? [ Runtime.NODEJS_12_X, Runtime.NODEJS_14_X ],
            description: props.description
        });

        new StringParameter(this, props.branchName + '-' + props.name + '-param-arn', {
            description: 'Access point of workflow trigger files',
            parameterName: `/${props.branchName}/lambda-layers/${props.name}`,
            stringValue: layer.layerVersionArn
        });
    }
}
