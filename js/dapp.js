const tokenAddress = "0x4F5D4a27625Cd12C8582E0ea390542a787D5d8f2";
const RSK_TESTNET_ID = 31;
let web3, accounts, bettingExchangeToken, bettingExchangeTokenABI;

async function initWeb3() {
  if (typeof window.ethereum === "undefined") {
    displayError("Please install MetaMask to use this dApp!");
    return;
  }

  try {
    // Request account access if needed
    await window.ethereum.enable();
  } catch (error) {
    displayError("Access to your Ethereum account rejected.");
    return;
  }

  web3 = new Web3(window.ethereum);
  const networkId = await web3.eth.net.getId();
  console.log(networkId);

  if (networkId !== RSK_TESTNET_ID) {
    displayError("Please switch to RSK testnet in your MetaMask!");
    return;
  }

  try {
    accounts = await web3.eth.getAccounts();
    if (accounts.length === 0) {
      displayError("No account available. Please log in to MetaMask.");
      return;
    }
    displayAddress(accounts[0]);

    if (!bettingExchangeTokenABI) {
      bettingExchangeTokenABI = await loadABI("BettingExchangeTokenABI.json");
    }
    bettingExchangeToken = new web3.eth.Contract(
      bettingExchangeTokenABI,
      tokenAddress
    );

    setupEventListeners();
    loadBets();
    await displayBalance(); // Display balance after initialization
  } catch (error) {
    displayError(error.message);
  }
}

async function requestAccounts() {
  try {
    return await window.ethereum.request({
      method: "eth_requestAccounts",
    });
  } catch (error) {
    throw new Error("Permission denied. Please allow access to your account.");
  }
}

function displayAddress(address) {
  document.getElementById("address").textContent = address;
}

function displayError(message) {
  console.error(message);
  document.getElementById("error-message").style.display = "block";
  document.getElementById("no-metamask").textContent = "Error: " + message;
}

function setupEventListeners() {
  window.ethereum.on("accountsChanged", () => {
    initWeb3();
  });

  window.ethereum.on("chainChanged", () => {
    initWeb3();
  });
}

async function loadABI(filename) {
  try {
    const response = await fetch(`./abis/${filename}`);
    return await response.json();
  } catch (error) {
    console.error(`Error loading ABI: ${filename}`, error);
    throw new Error("Failed to load ABI");
  }
}

async function displayBalance() {
  const balance = await bettingExchangeToken.methods
    .balanceOf(accounts[0])
    .call();
  document.getElementById("bet-balance").textContent = balance; // Assuming the balance is in a human-readable format
}

async function createBet() {
  const amount = document.getElementById("bet-amount").value;
  const oracleAddress = document.getElementById("oracle-address").value || null;

  if (!amount || isNaN(amount) || amount <= 0) {
    alert("Please enter a valid bet amount.");
    return;
  }

  try {
    // Assuming you have a method `createNewBet` in your contract
    const transaction = await bettingExchangeToken.methods
      .createNewBet(amount, oracleAddress)
      .send({ from: accounts[0] });

    if (transaction.status === true) {
      alert("Bet creation successful!");
      loadBets(); // Refresh the bet listings
    } else {
      console.error("Transaction failed", transaction);
      alert("Bet creation failed.");
    }
  } catch (error) {
    console.error(error);
    alert("Error creating bet. Check the console for more information.");
  }
}

async function acceptBet(betId) {
  try {
    await bettingExchangeToken.methods
      .acceptBet(betId)
      .send({ from: accounts[0] });
    alert("Bet successfully accepted!");

    loadBets();
  } catch (error) {
    console.error(error);
    alert("Error accepting bet. Check the console for more information.");
  }
}

async function loadBets() {
  const availableBetsDiv = document.getElementById("available-bets");
  const activeBetsDiv = document.getElementById("active-bets");

  // Clear previous bet lists
  availableBetsDiv.innerHTML = "";
  activeBetsDiv.innerHTML = "";

  // Fetch bet IDs in parallel for efficiency
  const [availableBetIds, activeBetIds] = await Promise.all([
    bettingExchangeToken.methods.getAvailableBets().call(),
    bettingExchangeToken.methods.getActiveBetsForUser(accounts[0]).call(),
  ]);

  // Load and display available bets
  for (let id of availableBetIds) {
    const bet = await bettingExchangeToken.methods.readBet(id).call();
    const betDiv = createBetDiv(bet, "available");
    availableBetsDiv.appendChild(betDiv);
  }

  // Load and display active bets for the user
  for (let id of activeBetIds) {
    const bet = await bettingExchangeToken.methods.readBet(id).call();
    const betDiv = createBetDiv(bet, "active");
    activeBetsDiv.appendChild(betDiv);
  }
}

async function settleBet(betId) {
  try {
    await bettingExchangeToken.methods
      .settle(betId)
      .send({ from: accounts[0] });
    alert("Bet successfully settled!");
    loadBets(); // Refresh the bet listings
  } catch (error) {
    console.error(error);
    alert("Error settling bet. Check the console for more information.");
  }
}

// Utility function to create a div for a bet based on its type (available or active)
function createBetDiv(bet, type) {
  const betElement = document.createElement("div");
  let actionButtons = "";

  if (type === "available") {
    if (bet.alice === accounts[0] && bet.state === "Listed") {
      actionButtons = `
        <button data-action="updateOracle" data-bet-id="${bet.id}">Update Oracle</button>
        <button data-action="cancelBet" data-bet-id="${bet.id}">Cancel</button>
      `;
    } else if (bet.state === "Listed") {
      actionButtons = `<button data-action="acceptBet" data-bet-id="${bet.id}">Accept Bet</button>`;
    }
  } else if (type === "active") {
    // Check if the current account is the oracle for the bet
    if (bet.oracle === accounts[0]) {
      actionButtons = `<button data-action="settleBet" data-bet-id="${bet.id}">Settle Bet</button>`;
    }
  }

  betElement.innerHTML = `
    <p>Bet ID: ${bet.id}</p>
    <p>Amount: ${bet.amount}</p>
    <p>Oracle: ${bet.oracle || "No oracle assigned"}</p>
    ${actionButtons}
`;

  return betElement;
}

// Initialize
document.getElementById("connect-button").addEventListener("click", initWeb3);

// Handle submissions
document.getElementById("bet-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  await createBet();
});

// Handle event delegation
document
  .getElementById("available-bets")
  .addEventListener("click", async function (e) {
    const target = e.target;
    if (target.tagName.toLowerCase() !== "button") return; // Early exit if the clicked element isn't a button

    const action = target.getAttribute("data-action");
    const betId = target.getAttribute("data-bet-id");

    if (!action || !betId) return; // Early exit if the button doesn't have the required data attributes

    switch (action) {
      case "acceptBet":
        await acceptBet(betId);
        break;
      case "updateOracle":
        const newOracleAddress = prompt("Enter the new Oracle address:");
        if (newOracleAddress) {
          await bettingExchangeToken.methods
            .updateOracle(betId, newOracleAddress)
            .send({ from: accounts[0] });
          alert("Oracle updated successfully!");
          loadBets(); // Refresh the bet listings
        }
        break;
      case "cancelBet":
        await bettingExchangeToken.methods
          .cancelBet(betId)
          .send({ from: accounts[0] });
        alert("Bet cancelled successfully!");
        loadBets(); // Refresh the bet listings
        break;
    }
  });

document
  .getElementById("active-bets")
  .addEventListener("click", async function (e) {
    const target = e.target;
    if (target.tagName.toLowerCase() !== "button") return; // Early exit if the clicked element isn't a button

    const action = target.getAttribute("data-action");
    const betId = target.getAttribute("data-bet-id");

    if (!action || !betId) return; // Early exit if the button doesn't have the required data attributes

    if (action === "settleBet") {
      // Assuming you'll implement this method
      await settleBet(betId);
    }
  });
