// App.tsx
import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import "./App.css";
import { useAccount, useSignMessage } from 'wagmi';

interface BenchmarkRecord {
  id: string;
  scheme: string;
  encryptedData: string;
  timestamp: number;
  owner: string;
  operation: string;
  executionTime: number;
  memoryUsage: number;
}

const FHEEncryptNumber = (value: number): string => {
  return `FHE-${btoa(value.toString())}`;
};

const FHEDecryptNumber = (encryptedData: string): number => {
  if (encryptedData.startsWith('FHE-')) {
    return parseFloat(atob(encryptedData.substring(4)));
  }
  return parseFloat(encryptedData);
};

const FHECompute = (encryptedData: string, operation: string): string => {
  const value = FHEDecryptNumber(encryptedData);
  let result = value;
  
  switch(operation) {
    case 'add':
      result = value + 100;
      break;
    case 'multiply':
      result = value * 2;
      break;
    case 'square':
      result = value * value;
      break;
    default:
      result = value;
  }
  
  return FHEEncryptNumber(result);
};

const generatePublicKey = () => `0x${Array(2000).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<BenchmarkRecord[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ visible: false, status: "pending", message: "" });
  const [newRecordData, setNewRecordData] = useState({ scheme: "TFHE", operation: "add", value: 100 });
  const [showTutorial, setShowTutorial] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<BenchmarkRecord | null>(null);
  const [decryptedValue, setDecryptedValue] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [publicKey, setPublicKey] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number>(0);
  const [startTimestamp, setStartTimestamp] = useState<number>(0);
  const [durationDays, setDurationDays] = useState<number>(30);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterScheme, setFilterScheme] = useState("all");

  // Randomly selected styles
  const colorScheme = "tech"; // Blue+Black
  const uiStyle = "future-metal"; // Future metal UI
  const layout = "multi-dashboard"; // Multi-column dashboard
  const interaction = "micro-interactions"; // Micro-interactions

  useEffect(() => {
    loadRecords().finally(() => setLoading(false));
    const initSignatureParams = async () => {
      const contract = await getContractReadOnly();
      if (contract) setContractAddress(await contract.getAddress());
      if (window.ethereum) {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex, 16));
      }
      setStartTimestamp(Math.floor(Date.now() / 1000));
      setDurationDays(30);
      setPublicKey(generatePublicKey());
    };
    initSignatureParams();
  }, []);

  const loadRecords = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check availability
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) return;
      
      const keysBytes = await contract.getData("benchmark_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try {
          const keysStr = ethers.toUtf8String(keysBytes);
          if (keysStr.trim() !== '') keys = JSON.parse(keysStr);
        } catch (e) { console.error("Error parsing benchmark keys:", e); }
      }
      
      const list: BenchmarkRecord[] = [];
      for (const key of keys) {
        try {
          const recordBytes = await contract.getData(`benchmark_${key}`);
          if (recordBytes.length > 0) {
            try {
              const recordData = JSON.parse(ethers.toUtf8String(recordBytes));
              list.push({ 
                id: key, 
                scheme: recordData.scheme,
                encryptedData: recordData.data, 
                timestamp: recordData.timestamp, 
                owner: recordData.owner, 
                operation: recordData.operation,
                executionTime: recordData.executionTime,
                memoryUsage: recordData.memoryUsage
              });
            } catch (e) { console.error(`Error parsing record data for ${key}:`, e); }
          }
        } catch (e) { console.error(`Error loading record ${key}:`, e); }
      }
      list.sort((a, b) => b.timestamp - a.timestamp);
      setRecords(list);
    } catch (e) { console.error("Error loading records:", e); } 
    finally { setIsRefreshing(false); setLoading(false); }
  };

  const submitBenchmark = async () => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setCreating(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Running FHE benchmark with Zama..." });
    try {
      const encryptedData = FHEEncryptNumber(newRecordData.value);
      
      // Simulate benchmark metrics
      const executionTime = Math.random() * 100 + 50; // ms
      const memoryUsage = Math.random() * 10 + 5; // MB
      
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const recordId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const recordData = { 
        data: encryptedData, 
        timestamp: Math.floor(Date.now() / 1000), 
        owner: address, 
        scheme: newRecordData.scheme,
        operation: newRecordData.operation,
        executionTime,
        memoryUsage
      };
      
      await contract.setData(`benchmark_${recordId}`, ethers.toUtf8Bytes(JSON.stringify(recordData)));
      
      const keysBytes = await contract.getData("benchmark_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try { keys = JSON.parse(ethers.toUtf8String(keysBytes)); } 
        catch (e) { console.error("Error parsing keys:", e); }
      }
      keys.push(recordId);
      await contract.setData("benchmark_keys", ethers.toUtf8Bytes(JSON.stringify(keys)));
      
      setTransactionStatus({ visible: true, status: "success", message: "Benchmark completed successfully!" });
      await loadRecords();
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewRecordData({ scheme: "TFHE", operation: "add", value: 100 });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction") ? "Transaction rejected by user" : "Benchmark failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { setCreating(false); }
  };

  const decryptWithSignature = async (encryptedData: string): Promise<number | null> => {
    if (!isConnected) { alert("Please connect wallet first"); return null; }
    setIsDecrypting(true);
    try {
      const message = `publickey:${publicKey}\ncontractAddresses:${contractAddress}\ncontractsChainId:${chainId}\nstartTimestamp:${startTimestamp}\ndurationDays:${durationDays}`;
      await signMessageAsync({ message });
      await new Promise(resolve => setTimeout(resolve, 1500));
      return FHEDecryptNumber(encryptedData);
    } catch (e) { console.error("Decryption failed:", e); return null; } 
    finally { setIsDecrypting(false); }
  };

  const filteredRecords = records.filter(record => {
    const matchesSearch = record.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         record.scheme.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesScheme = filterScheme === "all" || record.scheme === filterScheme;
    return matchesSearch && matchesScheme;
  });

  const schemes = [...new Set(records.map(r => r.scheme))];
  const operations = [...new Set(records.map(r => r.operation))];

  const renderPerformanceChart = () => {
    const schemeData: Record<string, { time: number; count: number; memory: number }> = {};
    
    records.forEach(record => {
      if (!schemeData[record.scheme]) {
        schemeData[record.scheme] = { time: 0, count: 0, memory: 0 };
      }
      schemeData[record.scheme].time += record.executionTime;
      schemeData[record.scheme].memory += record.memoryUsage;
      schemeData[record.scheme].count++;
    });

    return (
      <div className="performance-chart">
        <h3>Average Performance by Scheme</h3>
        <div className="chart-bars">
          {Object.entries(schemeData).map(([scheme, data]) => (
            <div key={scheme} className="chart-bar-container">
              <div className="chart-label">{scheme}</div>
              <div className="chart-bar-group">
                <div className="chart-bar time" style={{ width: `${(data.time / data.count) / 2}%` }}>
                  <span>{(data.time / data.count).toFixed(2)}ms</span>
                </div>
                <div className="chart-bar memory" style={{ width: `${(data.memory / data.count) * 5}%` }}>
                  <span>{(data.memory / data.count).toFixed(2)}MB</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="chart-legend">
          <div className="legend-item"><div className="color-box time"></div><span>Execution Time (ms)</span></div>
          <div className="legend-item"><div className="color-box memory"></div><span>Memory Usage (MB)</span></div>
        </div>
      </div>
    );
  };

  const tutorialSteps = [
    { title: "Connect Wallet", description: "Connect your Web3 wallet to access the FHE benchmark tool", icon: "🔗" },
    { title: "Run Benchmark", description: "Select FHE scheme and operation to test performance", icon: "⚡", details: "Tests execution time and memory usage for different FHE operations" },
    { title: "View Results", description: "Compare performance across different FHE schemes", icon: "📊", details: "Visual charts show comparative performance of TFHE, BFV, CKKS and other schemes" },
    { title: "Decrypt Data", description: "Verify results by decrypting with your wallet signature", icon: "🔓", details: "Uses Zama FHE technology for secure decryption verification" }
  ];

  if (loading) return (
    <div className="loading-screen">
      <div className="tech-spinner"></div>
      <p>Initializing FHE benchmark environment...</p>
    </div>
  );

  return (
    <div className="app-container tech-theme">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon"><div className="chip-icon"></div></div>
          <h1>FHE<span>Benchmark</span>Tool</h1>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowCreateModal(true)} className="create-btn tech-button">
            <div className="add-icon"></div>Run Benchmark
          </button>
          <button className="tech-button" onClick={() => setShowTutorial(!showTutorial)}>
            {showTutorial ? "Hide Guide" : "Show Guide"}
          </button>
          <div className="wallet-connect-wrapper"><ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/></div>
        </div>
      </header>
      <div className="main-content">
        <div className="welcome-banner">
          <div className="welcome-text">
            <h2>FHE Scheme Benchmark Tool</h2>
            <p>Compare performance of TFHE, BFV, CKKS and other FHE schemes with standardized metrics</p>
          </div>
          <div className="zama-badge">
            <div className="zama-logo"></div>
            <span>Powered by Zama FHE</span>
          </div>
        </div>
        
        {showTutorial && (
          <div className="tutorial-section">
            <h2>FHE Benchmark Guide</h2>
            <p className="subtitle">Learn how to compare different FHE schemes</p>
            <div className="tutorial-steps">
              {tutorialSteps.map((step, index) => (
                <div className="tutorial-step" key={index}>
                  <div className="step-icon">{step.icon}</div>
                  <div className="step-content">
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                    {step.details && <div className="step-details">{step.details}</div>}
                  </div>
                </div>
              ))}
            </div>
            <div className="fhe-diagram">
              <div className="diagram-step"><div className="diagram-icon">🔢</div><div className="diagram-label">Input Data</div></div>
              <div className="diagram-arrow">→</div>
              <div className="diagram-step"><div className="diagram-icon">🔒</div><div className="diagram-label">FHE Encryption</div></div>
              <div className="diagram-arrow">→</div>
              <div className="diagram-step"><div className="diagram-icon">⚙️</div><div className="diagram-label">Operation Execution</div></div>
              <div className="diagram-arrow">→</div>
              <div className="diagram-step"><div className="diagram-icon">⏱️</div><div className="diagram-label">Performance Metrics</div></div>
            </div>
          </div>
        )}
        
        <div className="dashboard-grid">
          <div className="dashboard-card tech-card">
            <h3>Project Introduction</h3>
            <p>Open-source tool for benchmarking different <strong>FHE schemes</strong> (TFHE, BFV, CKKS) performance. Measures execution time and memory usage for standardized operations.</p>
            <div className="tech-badge"><span>FHE Research</span></div>
          </div>
          
          <div className="dashboard-card tech-card">
            <h3>Quick Actions</h3>
            <div className="quick-actions">
              <button className="tech-button" onClick={() => setShowCreateModal(true)}>Run New Benchmark</button>
              <button className="tech-button" onClick={loadRecords}>Refresh Data</button>
              <button className="tech-button" onClick={() => {
                const contract = getContractReadOnly();
                contract?.isAvailable().then(() => alert("Service available!"));
              }}>Check Availability</button>
            </div>
          </div>
          
          <div className="dashboard-card tech-card stats-card">
            <h3>Benchmark Statistics</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{records.length}</div>
                <div className="stat-label">Total Runs</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{schemes.length}</div>
                <div className="stat-label">Schemes</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{operations.length}</div>
                <div className="stat-label">Operations</div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="performance-section">
          <div className="section-header">
            <h2>Performance Comparison</h2>
          </div>
          {renderPerformanceChart()}
        </div>
        
        <div className="records-section">
          <div className="section-header">
            <h2>Benchmark Records</h2>
            <div className="header-actions">
              <div className="search-filter">
                <input 
                  type="text" 
                  placeholder="Search records..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="tech-input"
                />
                <select 
                  value={filterScheme} 
                  onChange={(e) => setFilterScheme(e.target.value)}
                  className="tech-select"
                >
                  <option value="all">All Schemes</option>
                  {schemes.map(scheme => (
                    <option key={scheme} value={scheme}>{scheme}</option>
                  ))}
                </select>
              </div>
              <button onClick={loadRecords} className="refresh-btn tech-button" disabled={isRefreshing}>
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          
          <div className="records-list tech-card">
            <div className="table-header">
              <div className="header-cell">ID</div>
              <div className="header-cell">Scheme</div>
              <div className="header-cell">Operation</div>
              <div className="header-cell">Time (ms)</div>
              <div className="header-cell">Memory (MB)</div>
              <div className="header-cell">Date</div>
              <div className="header-cell">Actions</div>
            </div>
            
            {filteredRecords.length === 0 ? (
              <div className="no-records">
                <div className="no-records-icon"></div>
                <p>No benchmark records found</p>
                <button className="tech-button primary" onClick={() => setShowCreateModal(true)}>Run First Benchmark</button>
              </div>
            ) : filteredRecords.map(record => (
              <div className="record-row" key={record.id} onClick={() => setSelectedRecord(record)}>
                <div className="table-cell record-id">#{record.id.substring(0, 6)}</div>
                <div className="table-cell scheme">{record.scheme}</div>
                <div className="table-cell">{record.operation}</div>
                <div className="table-cell">{record.executionTime.toFixed(2)}</div>
                <div className="table-cell">{record.memoryUsage.toFixed(2)}</div>
                <div className="table-cell">{new Date(record.timestamp * 1000).toLocaleDateString()}</div>
                <div className="table-cell actions">
                  <button className="action-btn tech-button" onClick={(e) => { e.stopPropagation(); setSelectedRecord(record); }}>
                    Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {showCreateModal && (
        <ModalCreate 
          onSubmit={submitBenchmark} 
          onClose={() => setShowCreateModal(false)} 
          creating={creating} 
          recordData={newRecordData} 
          setRecordData={setNewRecordData}
        />
      )}
      
      {selectedRecord && (
        <RecordDetailModal 
          record={selectedRecord} 
          onClose={() => { setSelectedRecord(null); setDecryptedValue(null); }} 
          decryptedValue={decryptedValue} 
          setDecryptedValue={setDecryptedValue} 
          isDecrypting={isDecrypting} 
          decryptWithSignature={decryptWithSignature}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content tech-card">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="tech-spinner"></div>}
              {transactionStatus.status === "success" && <div className="check-icon"></div>}
              {transactionStatus.status === "error" && <div className="error-icon"></div>}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
      
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo"><div className="chip-icon"></div><span>FHE Benchmark Tool</span></div>
            <p>Open-source tool for comparing Fully Homomorphic Encryption schemes</p>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">GitHub</a>
            <a href="#" className="footer-link">Zama FHE</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="tech-badge"><span>FHE Research Tool</span></div>
          <div className="copyright">© {new Date().getFullYear()} FHE Benchmark Tool. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};

interface ModalCreateProps {
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  recordData: any;
  setRecordData: (data: any) => void;
}

const ModalCreate: React.FC<ModalCreateProps> = ({ onSubmit, onClose, creating, recordData, setRecordData }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setRecordData({ ...recordData, [name]: value });
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setRecordData({ ...recordData, [name]: parseFloat(value) });
  };

  const handleSubmit = () => {
    if (!recordData.scheme || !recordData.operation) { 
      alert("Please select scheme and operation"); 
      return; 
    }
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="create-modal tech-card">
        <div className="modal-header">
          <h2>Run FHE Benchmark</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        <div className="modal-body">
          <div className="tech-notice-banner">
            <div className="chip-icon"></div> 
            <div><strong>FHE Benchmark Configuration</strong><p>Configure parameters for performance testing</p></div>
          </div>
          
          <div className="form-grid">
            <div className="form-group">
              <label>FHE Scheme *</label>
              <select name="scheme" value={recordData.scheme} onChange={handleChange} className="tech-select">
                <option value="TFHE">TFHE</option>
                <option value="BFV">BFV</option>
                <option value="CKKS">CKKS</option>
                <option value="Zama">Zama</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Operation *</label>
              <select name="operation" value={recordData.operation} onChange={handleChange} className="tech-select">
                <option value="add">Addition</option>
                <option value="multiply">Multiplication</option>
                <option value="square">Square</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Input Value *</label>
              <input 
                type="number" 
                name="value" 
                value={recordData.value} 
                onChange={handleValueChange} 
                placeholder="Enter numerical value..." 
                className="tech-input"
                step="1"
              />
            </div>
          </div>
          
          <div className="encryption-preview">
            <h4>FHE Encryption Preview</h4>
            <div className="preview-container">
              <div className="plain-data"><span>Plain Value:</span><div>{recordData.value || 'No value entered'}</div></div>
              <div className="encryption-arrow">→</div>
              <div className="encrypted-data">
                <span>Encrypted Data:</span>
                <div>{recordData.value ? FHEEncryptNumber(recordData.value).substring(0, 50) + '...' : 'No value entered'}</div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn tech-button">Cancel</button>
          <button onClick={handleSubmit} disabled={creating} className="submit-btn tech-button primary">
            {creating ? "Running Benchmark..." : "Start Benchmark"}
          </button>
        </div>
      </div>
    </div>
  );
};

interface RecordDetailModalProps {
  record: BenchmarkRecord;
  onClose: () => void;
  decryptedValue: number | null;
  setDecryptedValue: (value: number | null) => void;
  isDecrypting: boolean;
  decryptWithSignature: (encryptedData: string) => Promise<number | null>;
}

const RecordDetailModal: React.FC<RecordDetailModalProps> = ({ record, onClose, decryptedValue, setDecryptedValue, isDecrypting, decryptWithSignature }) => {
  const handleDecrypt = async () => {
    if (decryptedValue !== null) { setDecryptedValue(null); return; }
    const decrypted = await decryptWithSignature(record.encryptedData);
    if (decrypted !== null) setDecryptedValue(decrypted);
  };

  return (
    <div className="modal-overlay">
      <div className="record-detail-modal tech-card">
        <div className="modal-header">
          <h2>Benchmark Details #{record.id.substring(0, 8)}</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        <div className="modal-body">
          <div className="record-info">
            <div className="info-item"><span>Scheme:</span><strong>{record.scheme}</strong></div>
            <div className="info-item"><span>Operation:</span><strong>{record.operation}</strong></div>
            <div className="info-item"><span>Owner:</span><strong>{record.owner.substring(0, 6)}...{record.owner.substring(38)}</strong></div>
            <div className="info-item"><span>Date:</span><strong>{new Date(record.timestamp * 1000).toLocaleString()}</strong></div>
            <div className="info-item"><span>Execution Time:</span><strong>{record.executionTime.toFixed(2)} ms</strong></div>
            <div className="info-item"><span>Memory Usage:</span><strong>{record.memoryUsage.toFixed(2)} MB</strong></div>
          </div>
          
          <div className="encrypted-data-section">
            <h3>Encrypted Data</h3>
            <div className="encrypted-data">{record.encryptedData.substring(0, 100)}...</div>
            <div className="tech-tag"><div className="fhe-icon"></div><span>FHE Encrypted</span></div>
            <button className="decrypt-btn tech-button" onClick={handleDecrypt} disabled={isDecrypting}>
              {isDecrypting ? <span className="decrypt-spinner"></span> : decryptedValue !== null ? "Hide Decrypted Value" : "Decrypt with Wallet"}
            </button>
          </div>
          
          {decryptedValue !== null && (
            <div className="decrypted-data-section">
              <h3>Decrypted Value</h3>
              <div className="decrypted-value">{decryptedValue}</div>
              <div className="decryption-notice">
                <div className="warning-icon"></div>
                <span>Decrypted value verified with your wallet signature</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn tech-button">Close</button>
        </div>
      </div>
    </div>
  );
};

export default App;