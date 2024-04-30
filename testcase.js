const { EC2Client, DescribeInstancesCommand, DescribeSecurityGroupsCommand } = require('@aws-sdk/client-ec2');
const { ElasticLoadBalancingV2Client, DescribeTargetGroupsCommand, DescribeTargetHealthCommand, DescribeLoadBalancersCommand, DescribeListenersCommand } = require('@aws-sdk/client-elastic-load-balancing-v2');
const { fromIni } = require('@aws-sdk/credential-provider-ini');

const REGION_NAME = 'us-west-2';

const ec2 = new EC2Client({
    region: REGION_NAME,
    credentials
});

const elbv2 = new ElasticLoadBalancingV2Client({
    region: REGION_NAME,
    credentials
});

const validateInstanceConfiguration = async () => {
    const result = [
        { name: "hostmachine1 is available in 'us-west-2a'", weightage: 0, status: false, error: '' },
        { name: "HTTP traffic is allowed in the 'hostmachine1'", weightage: 0, status: false, error: '' },
        { name: "hostmachine2 is available in 'us-west-2b'", weightage: 0, status: false, error: '' },
        { name: "HTTP traffic is allowed in the 'hostmachine2'", weightage: 0, status: false, error: '' },
        { name: "The 'webserver-tg' target group is created", weightage: 0, status: false, error: '' },
        { name: "'web-lb' Loadbalancer is created with the target group", weightage: 0, status: false, error: '' },
    ];

    try {
        const instanceData = await ec2.send(new DescribeInstancesCommand({
            Filters: [
                { Name: "instance-state-name", Values: ["running"] },
                { Name: "tag:Name", Values: ["hostmachine1"] },
            ],
        }));

        if (instanceData.Reservations[0] &&
            instanceData.Reservations[0].Instances &&
            instanceData.Reservations[0].Instances[0] &&
            instanceData.Reservations[0].Instances[0].Tags[0].Value == 'hostmachine1') {
            globalThis.instancedata1 = instanceData.Reservations[0].Instances[0];

            result[0].status = instancedata1.Placement.AvailabilityZone == 'us-west-2a';

            const securityGroupsData = await ec2.send(new DescribeSecurityGroupsCommand({
                GroupIds: [instancedata1.SecurityGroups[0].GroupId],
            }));

            result[1].status = true;
        } 

        const instanceData2 = await ec2.send(new DescribeInstancesCommand({
            Filters: [
                { Name: "instance-state-name", Values: ["running"] },
                { Name: "tag:Name", Values: ["hostmachine2"] },
            ],
        }));

        if (instanceData2.Reservations[0] &&
            instanceData2.Reservations[0].Instances &&
            instanceData2.Reservations[0].Instances[0] &&
            instanceData2.Reservations[0].Instances[0].Tags[0].Value == 'hostmachine2') {
            globalThis.instancedata2 = instanceData2.Reservations[0].Instances[0];

            result[2].status = instancedata2.Placement.AvailabilityZone == 'us-west-2b';

            const securityGroupsData2 = await ec2.send(new DescribeSecurityGroupsCommand({
                GroupIds: [instancedata2.SecurityGroups[0].GroupId],
            }));

            result[3].status = true;
        } 

        const targetGroupData = await elbv2.send(new DescribeTargetGroupsCommand({ Names: ['webserver-tg'] }));

        if (targetGroupData && targetGroupData.TargetGroups[0]) {
            const tgArn = targetGroupData.TargetGroups[0].TargetGroupArn;
            result[4].status = true;
        
            const loadBalancerData = await elbv2.send(new DescribeLoadBalancersCommand({ Names: ['web-lb'] }));

            if (loadBalancerData && loadBalancerData.LoadBalancers[0] && loadBalancerData.LoadBalancers[0].LoadBalancerArn) {
                const loadArn = loadBalancerData.LoadBalancers[0].LoadBalancerArn;
                const listenersData = await elbv2.send(new DescribeListenersCommand({ LoadBalancerArn: loadArn }));

                result[5].status = listenersData && listenersData.Listeners[0] && listenersData.Listeners[0].DefaultActions[0].TargetGroupArn == tgArn;
            } 
        } 
    } catch (error) {
        console.error('Errors:', error.message);
    }
    result[0].weightage = result[0].status ? 0.1 : 0;
    result[1].weightage = result[1].status ? 0.1 : 0;
    result[2].weightage = result[2].status ? 0.1 : 0;
    result[3].weightage = result[3].status ? 0.1 : 0;
    result[4].weightage = result[4].status ? 0.3 : 0;
    result[5].weightage = result[5].status ? 0.3 : 0;

    if (!result[0].status) result[0].error = "Instance 'hostmachine1' not found or not in the expected state.";
    if (!result[1].status) result[1].error = "Instance 'hostmachine1' security group does not allow HTTP traffic.";
    if (!result[2].status) result[2].error = "Instance 'hostmachine2' not found or not in the expected state.";
    if (!result[3].status) result[3].error = "Instance 'hostmachine2' security group does not allow HTTP traffic.";
    if (!result[4].status) result[4].error = "Target group 'webserver-tg' not found or not created.";
    if (!result[5].status) result[5].error = "LoadBalancer 'web-lb' not found or not created.";
    return result;
};

(async () => {
    try {
        const result = await validateInstanceConfiguration();
        console.log('Result:', result);
        return result;
    } catch (error) {
        console.error('Error:', error.message);
    }
})();
