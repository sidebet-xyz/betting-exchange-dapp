const button = document.getElementById("create-bet");

// Example of a function that simulates a transaction
function performTransaction() {
  button.disabled = true; // disable during a transaction

  // Simulating a delay (e.g., API call or processing time) using setTimeout
  setTimeout(() => {
    // After the transaction...
    button.disabled = false;
  }, 2000); // Delay for 2 seconds
}

button.addEventListener("click", performTransaction);
