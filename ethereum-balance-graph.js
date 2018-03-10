window.addEventListener('load', function () {
    if (typeof web3 !== 'undefined') {
        console.log('Web3 Detected! ' + web3.currentProvider.constructor.name)
        window.web3 = new Web3(web3.currentProvider);
    } else {
        console.log('No Web3 Detected... using HTTP Provider')
        window.web3 = new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io/<APIKEY>"));
    }
})

const promisify = (inner) =>
    new Promise((resolve, reject) =>
        inner((err, res) => {
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        })
    );

async function getFirstBlock(address) {
    try {
        let response = await fetch("https://api.etherscan.io/api?module=account&action=txlist&address=" + address + "&startblock=0&page=1&offset=10&sort=asc");
        let data = await response.json();

        if ((data.result).length > 0) {
            return data.result[0].blockNumber;
        } else {
            return -1;
        }
    } catch (error) {
        console.error(error);
    }
}

async function getBalanceInRange(address, startBlock, endBlock, step) {

    var promises = []
    var balances = []

    try {
        console.log(startBlock, endBlock)
        for (let i = startBlock; i < endBlock; i = i + step) {
            let promise = promisify(cb => web3.eth.getBalance(address, i, cb));
            promises.push(promise);
            balances.push({
                block: i,
                balance: null,
            });
        }

        var data = await Promise.all(promises);

        for (d in data) {
            balances[d].balance = parseFloat(web3.fromWei(data[d], 'ether'));
        }

        return balances;

    } catch (error) {
        document.getElementById("output").innerHTML = error;
    }
}

//Unpack a multi-dimensional array
function unpack(rows, index) {
    return rows.map(function (row) {
        return row[index];
    });
}

function createGraph(balances) {
    var trace = {
        type: "scatter",
        mode: "lines",
        name: 'Balance',
        x: unpack(balances, 'block'),
        y: unpack(balances, 'balance'),
        line: { color: '#17BECF' }
    }

    var data = [trace];

    var layout = {
        title: 'ETH Balance over Blocks',
        xaxis: {
            autorange: true,
            rangeslider: {},
            type: 'linear',
            title: 'Block'
        },
        yaxis: {
            autorange: true,
            type: 'linear',
            title: 'ETH Balance'
        },
    };

    Plotly.newPlot('graph', data, layout);

}

/*$('#graph').on('plotly_relayout',
    function (eventdata) {
        alert('ZOOM!' + '\n\n' +
            'Event data:' + '\n' +
            JSON.stringify(eventdata) + '\n\n' +
            'x-axis start:' + eventdata['xaxis.range[0]'] + '\n' +
            'x-axis end:' + eventdata['xaxis.range[1]']);
    });*/

async function graphBalance() {
    var address = document.getElementById("address").value;

    var startBlock = parseInt(await getFirstBlock(address));
    var endBlock = parseInt(web3.eth.blockNumber);

    var balances = await getBalanceInRange(address, startBlock, endBlock, 1000);

    createGraph(balances);

    console.log(balances);

}
