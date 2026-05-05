// 诊断脚本
console.log('1. 检查 Node 版本:');
console.log(process.version);

console.log('\n2. 检查 aedes 模块:');
const aedesModule = require('aedes');
console.log('模块导出:', Object.keys(aedesModule));

console.log('\n3. 创建 Aedes 实例:');
const { Aedes } = aedesModule;
const broker = new Aedes();
console.log('Aedes 实例创建成功!');

console.log('\n4. 测试完成');
process.exit(0);
