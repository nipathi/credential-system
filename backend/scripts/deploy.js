async function main() {
  // Get the contract factory for our CertiChain contract
  const CertiChain = await hre.ethers.getContractFactory("CertiChain");

  console.log("Deploying CertiChain contract...");

  // Deploy the contract
  const certiChain = await CertiChain.deploy();

  // Wait for the deployment to be confirmed on the blockchain
  await certiChain.waitForDeployment();

  // Print the permanent address of the deployed contract
  console.log(`CertiChain contract deployed to: ${certiChain.target}`);
}

// A standard pattern to run the main function and handle errors
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});