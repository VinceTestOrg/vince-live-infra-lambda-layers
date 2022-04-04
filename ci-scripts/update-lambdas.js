const {Lambda, SSM} = require('aws-sdk');

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
    // update them sequentially to not cause too much trouble with limits
    for (const lambdaConfig of lambdaConfigurations) {
        console.time('lambda ' + lambdaConfig.FunctionName);
        try {
            await awsLambda.updateFunctionConfiguration(lambdaConfig).promise();
            console.log('UPDATED', lambdaConfig.FunctionName, lambdaConfig.Layers);

        } catch (e) {
            console.error('I FUCKED UP! name:', lambdaConfig.FunctionName, lambdaConfig.Layers);
            console.error(e);
        }

        console.timeEnd('lambda ' + lambdaConfig.FunctionName);
    }
    console.timeEnd('lambdaUpdates');
    console.timeEnd('all');
})();
