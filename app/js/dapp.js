const tokenAddress = "YOUR_BETTING_EXCHANGE_TOKEN_ADDRESS_HERE";
let web3, accounts, bettingExchangeToken, readyState;

async function initWeb3() {
  if (typeof window.ethereum !== "undefined") {
    web3 = new Web3(window.ethereum);
    const networkId = await web3.eth.net.getId();

    if (networkId !== 31) {
      // 31 is RSK testnet chain ID
      alert("Please switch to RSK testnet in your MetaMask!");
      return;
    }

    try {
      // Request permission to access accounts
      accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      document.getElementById("address").textContent = accounts[0];

      const bettingExchangeTokenABI = await loadABI(
        "BettingExchangeTokenABI.json"
      );
      bettingExchangeToken = new web3.eth.Contract(
        bettingExchangeTokenABI,
        tokenAddress
      );

      // Event listeners for form submission and other buttons
      document
        .getElementById("bet-form")
        .addEventListener("submit", function (event) {
          event.preventDefault();
          createBet();
        });

      document.getElementById("accept-bet").addEventListener("click", () => {
        const betId = document.getElementById("bet-id-accept").value;
        acceptBet(betId);
      });

      document.getElementById("settle-bet").addEventListener("click", () => {
        const betId = document.getElementById("bet-id-settle").value;
        const winner =
          document.getElementById("winner-address-settle").value || accounts[0];
        settleBet(betId, winner);
      });

      window.ethereum.on("accountsChanged", () => {
        location.reload();
      });

      window.ethereum.on("chainChanged", () => {
        location.reload();
      });

      loadBets();
    } catch (error) {
      console.error("There was an error!", error);
      document.getElementById("error-message").style.display = "block";
      document.getElementById("no-metamask").textContent =
        "Error: " + error.message;
    }
  } else {
    console.error("Please install MetaMask to use this dApp!");
    document.getElementById("error-message").style.display = "block";
    document.getElementById("no-metamask").textContent =
      "Please install MetaMask to use this dApp!";
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

  try {
    await bettingExchangeToken.methods
      .createBet(amount, oracleAddress)
      .send({ from: accounts[0] });
    alert("Bet successfully created!");

    loadBets();
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

  // These methods would be defined on your smart contract
  const availableBets = await bettingExchangeToken.methods
    .getAvailableBets()
    .call();
  const activeBets = await bettingExchangeToken.methods
    .getActiveBetsForUser(accounts[0])
    .call();

  // Assuming each bet has a unique ID, an amount, and an oracle address
  availableBets.forEach((bet) => {
    const betElement = document.createElement("div");
    betElement.innerHTML = `
      <p>Bet ID: ${bet.id}</p>
      <p>Amount: ${bet.amount}</p>
      <p>Oracle: ${bet.oracle || "No oracle assigned"}</p>
      <button onClick="acceptBet(${bet.id})">Accept Bet</button>
    `;
    availableBetsDiv.appendChild(betElement);
  });

  activeBets.forEach((bet) => {
    const betElement = document.createElement("div");
    betElement.innerHTML = `
      <p>Bet ID: ${bet.id}</p>
      <p>Amount: ${bet.amount}</p>
      <p>Oracle: ${bet.oracle || "No oracle assigned"}</p>
      <button onClick="settleBet(${
        bet.id
      }, 'winnerAddressHere')">Settle Bet</button>
    `;
    activeBetsDiv.appendChild(betElement);
  });
}

async function loadABI(filename) {
  try {
    const response = await fetch(`./abis/${filename}`);
    const json = await response.json();
    return json;
  } catch (error) {
    console.error(`Error loading ABI: ${filename}`, error);
  }
}

// Initialize
initWeb3();
