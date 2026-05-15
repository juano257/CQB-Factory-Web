const dns = require('dns');
const regions = ['us-east-1','us-east-2','us-west-1','eu-west-1','eu-central-1','ap-southeast-1','sa-east-1'];
regions.forEach(r => {
  const host = 'aws-0-' + r + '.pooler.supabase.com';
  dns.resolve4(host, (err, addrs) => {
    if (!err) console.log('IPv4 OK:', host, addrs[0]);
  });
});
