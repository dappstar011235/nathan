const getOutAmount = (IN,RO,RI) => (IN*RO*9975)/(RI*10000+IN*9975);
const getSlippage = (IN,OUT,RO,RI)=>{
    const time = new Date().getTime();
    const a = OUT * 10000 * 9975;
    const b = OUT * (19975 * 10000 * RI + 9975 * 9975 * IN);
    const c = OUT * RI  * 10000 * RI * 10000 + OUT * RI * 10000 * IN * 9975 - RO * RI * 10000 * IN * 9975;
    const maxAmount = (Math.sqrt( b * b - 4 * a * c ) - b) / 2 / a;
    return maxAmount;
}
const getSlippage1 = (IN,OUT,RO,RI)=>{
    const maxAmount = Math.sqrt(RI ** 2 * 15700 + (IN ** 2 * 25) + (IN * RO * IN * (10**10) / OUT) -IN * IN * 5006250000);
    return maxAmount;
}
const getProfit = (frontAmount,RO,RI,amountIn) => {
    const OUTBOT = getOutAmount(frontAmount,RO,RI);
    const RI_1 = RI + frontAmount;
    const RO_1 = RO - OUTBOT;
    console.log('frontAmount',frontAmount,amountIn)
    console.log('OUTBOT',OUTBOT)
    console.log('RI_1',RI_1)
    console.log('RO_1',RO_1)
    
    const OUTWHALE = getOutAmount(amountIn,RO_1,RI_1);
    const RI_2 = RI_1 + amountIn;
    const RO_2 = RO_1 - OUTWHALE;
    console.log('OUTWHALE',OUTWHALE)
    console.log('RI_2',RI_2)
    console.log('RO_2',RO_2)

    const buybackAmount = getOutAmount(OUTBOT,RI_2,RO_2);
    console.log('buybackAmount',buybackAmount);

    const profit = buybackAmount - frontAmount;
    return profit;
}
const isProfit = (IN,OUT,RO,RI,maxBuy) => {
    const a = OUT * 10000 * 9975;
    const b = OUT * (19975 * 10000 * RI + 9975 * 9975 * IN);
    const c = OUT * RI  * 10000 * RI * 10000 + OUT * RI * 10000 * IN * 9975 - RO * RI * 10000 * IN * 9975;
    const sqrtV = (b * b - 4 * a * c) < 0 ? 0 : (b * b - 4 * a * c);
    const maxAmount = ( Math.sqrt( sqrtV ) - b) / 2 / a;
    if( maxAmount <= 0) return false;
    const frontRunAmount = maxAmount > maxBuy ? maxBuy : maxAmount;
    const OUTBOT = getOutAmount(frontRunAmount,RO,RI);
    const RI_1 = RI + frontRunAmount;
    const RO_1 = RO - OUTBOT;
    const OUTWHALE = getOutAmount(IN,RO_1,RI_1);
    const RI_2 = RI_1 + IN;
    const RO_2 = RO_1 - OUTWHALE;
    const buybackAmount = getOutAmount(OUTBOT,RI_2,RO_2);
    const profit = buybackAmount - frontRunAmount;
    return {frontRunAmount,profit};
}
const getFrontRunAmount1 = (IN,OUT,RO,RI,PR) => {
    const k = 0.995;
    const a = RO - OUT;
    const i = a * RI + RO * RI;
    const b = i + PR * a - k * a;
    const c = PR * i - k * a * RI - k * a * IN;
    const maxAmount = ( b - Math.sqrt( b * b - 4 * a * c )) / 2 / a;
    return [maxAmount + PR, maxAmount];
}
const getFrontRunAmount = (IN,OUT,RO,RI) => {
    const maxAmount = Math.sqrt(RO * RI * IN * 978 / OUT / 1000) - RI;
    const bought = RO * maxAmount * 9975 / (RI*10000 + maxAmount * 9975); 
    const profit = (RI + maxAmount + IN) * bought * 9975  / ((RO - OUT  - bought) * 10000 + bought * 9975) - maxAmount;
    return [maxAmount,profit];
}
const testData1= {
    frontAmount:19990,
    RO:56035141*10**18,
    RI:277379*10**18,
    amountIn:1378.61*10**18,
    amountOutMin:27526920851500,
}
const data = testData1;
// getslippage IN,OUT,RO,RI
const {frontRunAmount,profit} = isProfit(data.amountIn,data.amountOutMin,data.RO,data.RI,2000*10**18);
console.log({frontRunAmount:frontRunAmount/10**18,profit:profit/10**18});