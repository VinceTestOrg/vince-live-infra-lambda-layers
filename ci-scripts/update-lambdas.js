const {Lambda, SSM} = require('aws-sdk');
const pLimit = require('p-limit');
const limiter = pLimit(5);

const awsLambda = new Lambda({
    region: process.env.AWS_REGION
});

const awsSsm = new SSM({
    region: process.env.AWS_REGION
});

const stage = process.env.STAGE;

function getLayerArn(fullArnWithVersion) {
    return fullArnWithVersion.split(':').slice(0,7).join(':');
}

function getLayerVersion(fullArnWithVersion) {
    return parseInt(fullArnWithVersion.split(':')[7]);
}

(async () => {
    console.time('all');

    console.time('layers');
    // get layers that are relevant
    let arns = [];
    let paramRes;
    do {
        paramRes = await awsSsm.getParametersByPath({
            Path: `/${stage}/lambda-layers/`,
            NextToken: paramRes?.NextToken
        }).promise();
        arns = [...arns, ...paramRes.Parameters.map(p => p.Value)];

    } while (paramRes?.NextToken);

    const layers = {};
    for (const a of arns) {
        layers[getLayerArn(a)] = getLayerVersion(a);
    }
    console.log(layers);

    console.timeEnd('layers');

    console.time('lambda scan time');

    let lambdas = [];
    let res;
    let numLambdasTotal = 0;
    do {
        res = await awsLambda.listFunctions({
            MaxItems: 50,
            Marker: res?.NextMarker
        }).promise();

        numLambdasTotal += res.Functions.length;

        lambdas = [
            ...lambdas,
            ...res.Functions
                .filter(fn => (fn.Layers?.length ?? 0) > 0)
                .filter(fn => fn.Layers.some(layer => {
                    const arn = getLayerArn(layer.Arn);
                    const version = getLayerVersion(layer.Arn);
                    const newestVersion = layers?.[arn];
                    return newestVersion !== undefined && version < newestVersion;
                }))
        ];

    } while (res?.NextMarker);

    console.log('scanned', numLambdasTotal, 'lambdas');
    console.timeEnd('lambda scan time');
    console.log('found', lambdas.length, 'with layers to update');


    // now for each layer, generate a new layer configuration, but ensure to keep the order

    const lambdaConfigurations = [];
    const debugData = [];
    Object.keys(layers).forEach(arnWithoutVersion => {
        lambdas.forEach(lambda => {
            const newArn = arnWithoutVersion + ':' + layers[arnWithoutVersion];
            const replaceIndex = lambda.Layers.findIndex(t => t.Arn.startsWith(arnWithoutVersion));
            const newLayerArns = [];
            lambda.Layers.forEach((t, layerIndex) => {
                newLayerArns[layerIndex] = layerIndex === replaceIndex
                    ? newArn // update with new
                    : t.Arn; // keep existing
            });
            const lambdaConfiguration = {
                FunctionName: lambda.FunctionName,
                Layers: newLayerArns
            };
            lambdaConfigurations.push(lambdaConfiguration);

            debugData.push({
                functionName: lambda.FunctionName,
                replaceIndex,
                previous: lambda.Layers[replaceIndex].Arn,
                updated: newArn,
                newLayerArns
            });
        });
    });

    console.table(debugData);

    console.log('======================== STARTING LAMBDA CONFIGURATION UPDATES ==========================');
    console.time('lambdaUpdates');

    const promises = [];
    lambdaConfigurations.forEach(lambdaConfig => {
        promises.push(limiter(() => awsLambda.updateFunctionConfiguration(lambdaConfig).promise()));
    });
    const results = await Promise.allSettled(promises);
    console.log(await Promise.allSettled(promises));
    const succeeded = results.filter(res => res.status === 'fulfilled');
    const rejected = results.filter(res => res.status === 'rejected');
    console.log('====== DONE UPDATING ==== ');
    console.log('Succeeded: (', succeeded?.length, '): ');
    console.log('Failures (', rejected?.length, '): ');
    console.log(rejected);
    console.log({
        numSucceeded: succeeded?.length,
        numRejected: rejected?.length
    });

    console.timeEnd('lambdaUpdates');
    console.timeEnd('all');
    if (rejected.length > 0) {
        process.exit(1); // fail with error
    }
})();
