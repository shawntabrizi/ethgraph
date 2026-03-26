// Global Variables
var global = {
    balances: [],
    address: "",
    pointCount: 200
}

// Public RPC (no API key needed)
const PUBLIC_RPC = "https://ethereum-rpc.publicnode.com";
const provider = new ethers.JsonRpcProvider(PUBLIC_RPC);

// Get the first transaction block for an address via Etherscan API
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

// Update window URL to contain querystring, making it easy to share
function updateUrl(startBlock, endBlock) {
    var url = [location.protocol, '//', location.host, location.pathname].join('');
    url += "?address=" + global.address + "&start=" + startBlock + "&end=" + endBlock;
    window.history.replaceState({ path: url }, '', url);
}

// Given an address and a range of blocks, query the Ethereum blockchain for the ETH balance across the range
async function getBalanceInRange(address, startBlock, endBlock) {

    // Update UX with Start and End Block
    document.getElementById('startBlock').value = startBlock;
    document.getElementById('endBlock').value = endBlock;

    // Update window URL
    updateUrl(startBlock, endBlock);

    // Calculate the step size given the range of blocks and the number of points we want
    var step = Math.floor((endBlock - startBlock) / global.pointCount)
    // Make sure step is at least 1
    if (step < 1) {
        step = 1;
    }

    // Tell the user the data is loading...
    document.getElementById("output").innerHTML = "Loading";

    try {
        var balancePromises = []
        var blockPromises = []
        var blocks = []

        // Loop over the blocks, using the step value
        for (let i = startBlock; i < endBlock; i = i + step) {
            // If we already have data about that block, skip it
            if (!global.balances.find(x => x.block == i)) {
                blocks.push(i);
                balancePromises.push(provider.getBalance(address, i));
                blockPromises.push(provider.getBlock(i));
            }
        }

        // Call all promises in parallel for speed
        var [balanceResults, blockResults] = await Promise.all([
            Promise.all(balancePromises),
            Promise.all(blockPromises)
        ]);

        // Restructure the data into an array of objects
        var balances = []
        for (let i = 0; i < blocks.length; i++) {
            balances.push({
                block: blocks[i],
                balance: parseFloat(ethers.formatEther(balanceResults[i])),
                time: new Date(blockResults[i].timestamp * 1000)
            })
        }

        // Remove loading message
        document.getElementById("output").innerHTML = "";

        return balances;

    } catch (error) {
        document.getElementById("output").innerHTML = error.message;
    }
}

// Unpack a multi-dimensional object
function unpack(rows, index) {
    return rows.map(function (row) {
        return row[index];
    });
}

// Create the plotly.js graph
function createGraph(balances) {
    // Create the trace we are going to plot
    var trace = {
        type: "scatter",
        mode: "lines",
        x: unpack(balances, 'block'),
        y: unpack(balances, 'balance'),
        hoverinfo: "y+text",
        text: unpack(balances, 'time')
    }

    // Settings for the graph
    var layout = {
        title: 'ETH Balance over Ethereum Blocks',
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
        }
    };

    Plotly.newPlot('graph', [trace], layout);
}

// Sort function for sort by block value
function sortBlock(a, b) {
    return a.block - b.block;
}

// When the graph is zoomed in, get more data points for that range
function setupZoomHandler() {
    var graphDiv = document.getElementById('graph');
    graphDiv.on('plotly_relayout', async function (eventdata) {
        // Get the new block range from the graph layout
        var startBlock = Math.floor(graphDiv.layout.xaxis.range[0]);
        var endBlock = Math.ceil(graphDiv.layout.xaxis.range[1]);

        // Get new balance data, and concatenate it to the existing data
        global.balances = global.balances.concat(await getBalanceInRange(global.address, startBlock, endBlock))

        // Sort the data by block number for Plotly.js, since it is a scatter plot
        global.balances.sort(sortBlock);

        // Create a new trace with new data
        var trace = {
            type: "scatter",
            mode: "lines",
            x: unpack(global.balances, 'block'),
            y: unpack(global.balances, 'balance'),
            hoverinfo: "y+text",
            text: unpack(global.balances, 'time')
        }

        // Add new trace, then remove the old one
        Plotly.addTraces('graph', trace);
        Plotly.deleteTraces('graph', 0);
    });
}

// Reset the page
function reset() {
    document.getElementById('output').innerHTML = "";
    Plotly.purge('graph');
    global.balances = [];
    global.address = "";
}

// Main function
async function graphBalance() {
    try {
        reset();

        // Get address from input
        global.address = document.getElementById("address").value;

        // Find the initial range, from first block to current block
        var startBlock, endBlock;

        if (document.getElementById('startBlock').value) {
            startBlock = parseInt(document.getElementById('startBlock').value);
        } else {
            startBlock = parseInt(await getFirstBlock(global.address));
        }

        if (document.getElementById('endBlock').value) {
            endBlock = parseInt(document.getElementById('endBlock').value);
        } else {
            endBlock = await provider.getBlockNumber();
        }

        // Check that the address actually has transactions to show
        if (startBlock >= 0 && startBlock < endBlock) {
            // Get the balances from that range, store in global variable
            global.balances = await getBalanceInRange(global.address, startBlock, endBlock);

            // Create the graph
            createGraph(global.balances);

            // Set up zoom handler after graph is created
            setupZoomHandler();
        } else {
            document.getElementById('output').innerHTML = "No transactions found for that address."
        }
    } catch (error) {
        document.getElementById("output").innerHTML = error.message;
    }
}

// Detect Querystrings
function parseQueryStrings() {
    var queryStrings = {};
    var url = window.location.search.substring(1);
    if (url) {
        var pairs = url.split("&");
        for (pair in pairs) {
            pairArray = pairs[pair].split("=");
            queryStrings[pairArray[0]] = pairArray[1]
        }
    }
    return queryStrings;
}

// On load, check if querystrings are present
window.onload = async function () {
    var queryStrings = parseQueryStrings();

    if (queryStrings['address']) {
        document.getElementById('address').value = queryStrings['address'];
    }
    if (queryStrings['start']) {
        document.getElementById('startBlock').value = queryStrings['start'];
    }
    if (queryStrings['end']) {
        document.getElementById('endBlock').value = queryStrings['end'];
    }
    if (queryStrings['address']) {
        await graphBalance();
    }
}
