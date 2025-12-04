# FHE Benchmark Tool: Performance Testing for FHE Schemes

The **FHE Benchmark Tool** is an essential resource for developers looking to evaluate the performance of various Fully Homomorphic Encryption (FHE) schemes. Leveraging **Zama's Fully Homomorphic Encryption technology**, this open-source tool provides a comprehensive framework to benchmark the efficiency of prominent FHE schemes such as TFHE, BFV, and CKKS, allowing for detailed comparisons based on speed and memory consumption.

## The Challenge of FHE Performance Evaluation

In the rapidly advancing landscape of cryptography and privacy-preserving computations, developers face significant hurdles when selecting the right FHE scheme for their applications. The challenges often include a lack of standardized performance metrics and difficulty in comparing the efficiency of various encryption methods. These issues can lead to suboptimal choices, impacting the security and efficiency of applications built on these cryptographic foundations.

## How FHE Tackles This Issue

The FHE Benchmark Tool addresses these challenges head-on by offering a standardized suite for performance testing. By employing **Zama’s open-source libraries**, including **Concrete**, **TFHE-rs**, and the **zama-fhe SDK**, developers can conduct benchmarks under consistent conditions across diverse hardware and task types. This allows for meaningful performance comparisons, helping developers make informed decisions about which FHE scheme best suits their specific needs.

## Key Features

- **Standardized FHE Performance Testing Suite**: A complete framework to assess and compare different FHE schemes based on specific performance criteria.
- **Visual Performance Comparison Reports**: Generates insightful visual reports that illustrate the performance metrics of each FHE scheme tested.
- **Developer Guidance for Scheme Selection**: Aids developers in identifying the most appropriate FHE scheme for their applications based on benchmark results.
- **Contribution to FHE Technology Optimization**: Supports ongoing efforts to optimize and popularize Fully Homomorphic Encryption technology in real-world applications.

## Technology Stack

The FHE Benchmark Tool is built upon a robust technology stack which includes:

- **Node.js**: To facilitate server-side JavaScript execution.
- **Hardhat/Foundry**: For easy smart contract development and testing.
- **Zama SDK**: The core component for confidential computations, specifically designed for working with Fully Homomorphic Encryption.

## Directory Structure

The project is organized as follows:

```
FHE_Benchmark_Tool/
│
├── benchmark/
│   ├── benchmarks.rs           # Performance benchmark configurations
│   └── report_generator.js      # Visual report generation logic
│
├── contracts/
│   └── FHE_Benchmark_Tool.sol   # Smart contract for managing benchmarks
│
├── scripts/
│   └── run_benchmarks.js        # Script to execute benchmarks
│
├── tests/
│   └── benchmark_tests.js        # Automated tests for benchmark logic
│
├── README.md                    # Project documentation
└── package.json                 # NPM dependencies and scripts
```

## Installation Guide

To set up the FHE Benchmark Tool on your local machine, you must first ensure you have the following key dependencies installed:

1. Node.js (version 14 or above)
2. Hardhat or Foundry (for smart contract development)

Once these dependencies are confirmed, follow these steps:

1. Download the project files without using `git clone` or any URLs.
2. Navigate to the project directory.
3. Run the following command to install all required NPM packages, including the Zama FHE libraries:

   ```bash
   npm install
   ```

This will ensure that all necessary libraries are correctly installed.

## Build & Run Guide

To compile, test, and run the project, execute the following commands in your terminal:

1. **Compile the smart contracts**:
   ```bash
   npx hardhat compile
   ```
   
2. **Run the benchmark tests**:
   ```bash
   npx hardhat test
   ```

3. **Execute the benchmark scripts**:
   ```bash
   node scripts/run_benchmarks.js
   ```

These commands will help you ensure that the project is functioning correctly and that all benchmarks can be executed as planned.

## Code Example

Here’s a brief code snippet demonstrating how the FHE Benchmark Tool can be utilized to run a benchmark:

```javascript
const Benchmark = require('./benchmark/benchmarks');
const ReportGenerator = require('./benchmark/report_generator');

async function runFHEBenchmark() {
    const results = await Benchmark.runAllBenchmarks();
    const report = ReportGenerator.generate(results);

    console.log("Benchmark Report Generated:\n", report);
}

runFHEBenchmark();
```

This example illustrates the simplicity with which developers can initiate benchmarking and generate performance reports using the provided functions within the tool.

## Acknowledgements

### Powered by Zama

This project would not be possible without the groundbreaking work of the Zama team. Their commitment to creating open-source tools facilitates the development of confidential blockchain applications and helps secure the future of privacy-preserving computation. Thank you, Zama, for your invaluable contributions to the field of cryptography!
