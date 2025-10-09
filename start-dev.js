#!/usr/bin/env node

/**
 * Kiwi Photo Library Development Server Startup Script
 * Cross-platform script to start both backend and frontend servers
 */

import { spawn, exec } from 'child_process';
import path from 'path';
import fs from 'fs';

// Configuration
const CONFIG = {
  backendPort: 3001,
  frontendPort: 3000,
  backendDir: 'server',
  frontendDir: '.',
  backendCommand: 'node index.js',
  frontendCommand: 'npm run dev'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorLog(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function killProcessOnPort(port) {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const command = isWindows 
      ? `netstat -ano | findstr :${port}`
      : `lsof -ti:${port}`;
    
    exec(command, (error, stdout) => {
      if (error || !stdout.trim()) {
        colorLog(`No processes found on port ${port}`, 'cyan');
        resolve();
        return;
      }
      
      if (isWindows) {
        // Parse Windows netstat output
        const lines = stdout.split('\n');
        const pids = new Set();
        
        lines.forEach(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            const pid = parts[parts.length - 1];
            if (pid && !isNaN(parseInt(pid))) {
              pids.add(pid);
            }
          }
        });
        
        if (pids.size > 0) {
          colorLog(`Killing processes on port ${port}...`, 'yellow');
          pids.forEach(pid => {
            exec(`taskkill /PID ${pid} /F`, (err) => {
              if (!err) {
                colorLog(`Killed process ${pid}`, 'green');
              }
            });
          });
        }
      } else {
        // Unix-like systems
        const pids = stdout.trim().split('\n');
        if (pids.length > 0 && pids[0]) {
          colorLog(`Killing processes on port ${port}...`, 'yellow');
          pids.forEach(pid => {
            exec(`kill -9 ${pid}`, (err) => {
              if (!err) {
                colorLog(`Killed process ${pid}`, 'green');
              }
            });
          });
        }
      }
      
      setTimeout(resolve, 1000); // Wait for processes to be killed
    });
  });
}

function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const command = isWindows 
      ? `netstat -an | findstr :${port}`
      : `lsof -i:${port}`;
    
    exec(command, (error, stdout) => {
      resolve(!stdout.trim());
    });
  });
}

function installDependencies(dir, name) {
  return new Promise((resolve) => {
    if (!fs.existsSync(path.join(dir, 'package.json'))) {
      colorLog(`No package.json found in ${dir}`, 'yellow');
      resolve(true);
      return;
    }
    
    colorLog(`Installing dependencies for ${name}...`, 'cyan');
    
    const npm = spawn('npm', ['install'], {
      cwd: dir,
      stdio: 'inherit',
      shell: true
    });
    
    npm.on('close', (code) => {
      if (code === 0) {
        colorLog(`${name} dependencies installed successfully`, 'green');
        resolve(true);
      } else {
        colorLog(`Failed to install ${name} dependencies`, 'red');
        resolve(false);
      }
    });
    
    npm.on('error', (err) => {
      colorLog(`Error installing ${name} dependencies: ${err.message}`, 'red');
      resolve(false);
    });
  });
}

function startServer(dir, command, name, port) {
  return new Promise((resolve, reject) => {
    colorLog(`Starting ${name}...`, 'cyan');
    
    const [cmd, ...args] = command.split(' ');
    const server = spawn(cmd, args, {
      cwd: dir,
      stdio: 'pipe',
      shell: true
    });
    
    let started = false;
    let outputBuffer = [];
    let errorBuffer = [];
    const startTime = Date.now();
    
    // Handle server output
    server.stdout.on('data', (data) => {
      const output = data.toString();
      outputBuffer.push(output);
      
      // Keep only last 50 lines
      if (outputBuffer.length > 50) outputBuffer.shift();
      
      process.stdout.write(`${colors.blue}[${name}]${colors.reset} ${output}`);
      
      // Check if server started successfully
      if (!started && (
        output.includes('listening') || 
        output.includes('Server ready') || 
        output.includes('ready to serve') ||
        output.toLowerCase().includes('local:') ||  // Case-insensitive for Vite
        output.includes('ready in')  // Vite "ready in XXX ms"
      )) {
        started = true;
        const startupTime = ((Date.now() - startTime) / 1000).toFixed(1);
        colorLog(`${name} started successfully on port ${port} (${startupTime}s)`, 'green');
        resolve(server);
      }
    });
    
    server.stderr.on('data', (data) => {
      const output = data.toString();
      errorBuffer.push(output);
      
      // Keep only last 50 lines
      if (errorBuffer.length > 50) errorBuffer.shift();
      
      process.stderr.write(`${colors.red}[${name}]${colors.reset} ${output}`);
      
      // Check for common errors
      if (output.toLowerCase().includes('enoent')) {
        colorLog(`\n❌ ${name} ERROR: File or directory not found`, 'red');
        colorLog(`   Command: ${command}`, 'yellow');
        colorLog(`   Working directory: ${path.resolve(dir)}`, 'yellow');
      } else if (output.toLowerCase().includes('eaddrinuse')) {
        colorLog(`\n❌ ${name} ERROR: Port ${port} is already in use`, 'red');
        colorLog(`   Try running with --kill flag to stop existing processes`, 'yellow');
      } else if (output.toLowerCase().includes('cannot find module')) {
        colorLog(`\n❌ ${name} ERROR: Missing dependencies`, 'red');
        colorLog(`   Try running with --install flag to install dependencies`, 'yellow');
      } else if (output.toLowerCase().includes('eacces') || output.toLowerCase().includes('eperm')) {
        colorLog(`\n❌ ${name} ERROR: Permission denied`, 'red');
        colorLog(`   Try running with administrator/sudo privileges`, 'yellow');
      }
    });
    
    server.on('error', (err) => {
      colorLog(`\n❌ Failed to start ${name}: ${err.message}`, 'red');
      colorLog(`   Command: ${command}`, 'yellow');
      colorLog(`   Working directory: ${path.resolve(dir)}`, 'yellow');
      reject(err);
    });
    
    server.on('close', (code) => {
      if (code !== 0 && !started) {
        colorLog(`\n❌ ${name} exited with code ${code}`, 'red');
        
        // Show diagnostic information
        colorLog('\n📊 Diagnostic Information:', 'yellow');
        colorLog(`   Command: ${command}`, 'cyan');
        colorLog(`   Working directory: ${path.resolve(dir)}`, 'cyan');
        colorLog(`   Exit code: ${code}`, 'cyan');
        colorLog(`   Runtime: ${((Date.now() - startTime) / 1000).toFixed(1)}s`, 'cyan');
        
        if (errorBuffer.length > 0) {
          colorLog('\n📝 Last Error Output:', 'yellow');
          errorBuffer.slice(-10).forEach(line => {
            process.stderr.write(`   ${line}`);
          });
        }
        
        if (outputBuffer.length > 0) {
          colorLog('\n📝 Last Standard Output:', 'yellow');
          outputBuffer.slice(-10).forEach(line => {
            process.stdout.write(`   ${line}`);
          });
        }
        
        colorLog('\n💡 Troubleshooting Tips:', 'yellow');
        colorLog('   1. Check if dependencies are installed: npm run start:kill --install', 'cyan');
        colorLog('   2. Verify the library path exists: X:\\Photos\\lib\\homework.library', 'cyan');
        colorLog('   3. Check database permissions and integrity', 'cyan');
        colorLog('   4. Review error messages above for specific issues', 'cyan');
        
        reject(new Error(`${name} failed to start with exit code ${code}`));
      }
    });
    
    // Timeout after 60 seconds for large databases (30 seconds was too short for 250MB+ databases)
    setTimeout(() => {
      if (!started) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        
        colorLog(`\n⏱️  ${name} startup timeout after ${elapsed}s`, 'red');
        colorLog('\n📊 Diagnostic Information:', 'yellow');
        colorLog(`   Command: ${command}`, 'cyan');
        colorLog(`   Working directory: ${path.resolve(dir)}`, 'cyan');
        colorLog(`   Expected port: ${port}`, 'cyan');
        colorLog(`   Timeout threshold: 60 seconds`, 'cyan');
        
        if (errorBuffer.length > 0) {
          colorLog('\n📝 Last Error Output (may indicate issue):', 'yellow');
          errorBuffer.slice(-10).forEach(line => {
            process.stderr.write(`   ${line}`);
          });
        } else {
          colorLog('\n⚠️  No error output captured', 'yellow');
        }
        
        if (outputBuffer.length > 0) {
          colorLog('\n📝 Last Standard Output:', 'yellow');
          outputBuffer.slice(-10).forEach(line => {
            process.stdout.write(`   ${line}`);
          });
          
          // Analyze output for common issues
          const fullOutput = outputBuffer.join('');
          if (fullOutput.includes('Initializing') && !fullOutput.includes('initialized successfully')) {
            colorLog('\n🔍 Detected: Server stuck during initialization', 'red');
            colorLog('   Possible causes:', 'yellow');
            colorLog('   • Database connection issues', 'cyan');
            colorLog('   • Large database taking longer to initialize', 'cyan');
            colorLog('   • File system permission problems', 'cyan');
            colorLog('   • Missing or corrupted database file', 'cyan');
          }
        } else {
          colorLog('\n⚠️  No standard output captured - server may have failed to start', 'yellow');
        }
        
        colorLog('\n💡 Troubleshooting Tips:', 'yellow');
        colorLog('   1. Timeout is set to 60s for large databases (edit start-dev.js line 247 to increase)', 'cyan');
        colorLog('   2. Check server logs in the terminal above', 'cyan');
        colorLog('   3. Verify library path: X:\\Photos\\lib\\homework.library', 'cyan');
        colorLog('   4. Test database manually: node server/check_db.js', 'cyan');
        colorLog('   5. Try running backend directly: cd server && node index.js', 'cyan');
        
        server.kill();
        reject(new Error(`${name} startup timeout - check diagnostics above`));
      }
    }, 60000); // 60 seconds for large databases
  });
}

async function main() {
  const args = process.argv.slice(2);
  const killExisting = args.includes('--kill') || args.includes('-k');
  const installDeps = args.includes('--install') || args.includes('-i');
  const help = args.includes('--help') || args.includes('-h');
  
  if (help) {
    colorLog('Kiwi Photo Library Development Server Startup Script', 'green');
    colorLog('', 'reset');
    colorLog('Usage: node start-dev.js [options]', 'yellow');
    colorLog('', 'reset');
    colorLog('Options:', 'yellow');
    colorLog('  --kill, -k       Kill existing processes on ports 3000 and 3001', 'white');
    colorLog('  --install, -i    Install dependencies before starting servers', 'white');
    colorLog('  --help, -h       Show this help message', 'white');
    colorLog('', 'reset');
    colorLog('Examples:', 'yellow');
    colorLog('  node start-dev.js                    # Start servers normally', 'white');
    colorLog('  node start-dev.js --kill             # Kill existing processes first', 'white');
    colorLog('  node start-dev.js --install          # Install deps and start', 'white');
    colorLog('  node start-dev.js --kill --install   # Full reset and start', 'white');
    return;
  }
  
  colorLog('🚀 Starting Kiwi Photo Library Development Servers', 'green');
  colorLog('=================================================', 'green');
  
  // Check if we're in the right directory
  if (!fs.existsSync('package.json')) {
    colorLog('ERROR: package.json not found. Please run this script from the project root.', 'red');
    process.exit(1);
  }
  
  if (!fs.existsSync(path.join(CONFIG.backendDir, 'index.js'))) {
    colorLog('ERROR: server/index.js not found. Please check your backend setup.', 'red');
    process.exit(1);
  }
  
  try {
    // Kill existing processes if requested
    if (killExisting) {
      colorLog('Killing existing processes...', 'yellow');
      await killProcessOnPort(CONFIG.backendPort);
      await killProcessOnPort(CONFIG.frontendPort);
    }
    
    // Install dependencies if requested
    if (installDeps) {
      colorLog('Installing dependencies...', 'cyan');
      
      const frontendSuccess = await installDependencies(CONFIG.frontendDir, 'Frontend');
      if (!frontendSuccess) {
        colorLog('Failed to install frontend dependencies', 'red');
        process.exit(1);
      }
      
      const backendSuccess = await installDependencies(CONFIG.backendDir, 'Backend');
      if (!backendSuccess) {
        colorLog('Failed to install backend dependencies', 'red');
        process.exit(1);
      }
    }
    
    // Check if ports are available
    if (!killExisting) {
      const backendAvailable = await checkPortAvailable(CONFIG.backendPort);
      const frontendAvailable = await checkPortAvailable(CONFIG.frontendPort);
      
      if (!backendAvailable) {
        colorLog(`Port ${CONFIG.backendPort} is already in use. Use --kill to kill existing processes.`, 'red');
        process.exit(1);
      }
      
      if (!frontendAvailable) {
        colorLog(`Port ${CONFIG.frontendPort} is already in use. Use --kill to kill existing processes.`, 'red');
        process.exit(1);
      }
    }
    
    // Start backend server
    const backendServer = await startServer(
      CONFIG.backendDir,
      CONFIG.backendCommand,
      'Backend',
      CONFIG.backendPort
    );
    
    // Start frontend server
    const frontendServer = await startServer(
      CONFIG.frontendDir,
      CONFIG.frontendCommand,
      'Frontend',
      CONFIG.frontendPort
    );
    
    // Success message
    colorLog('', 'reset');
    colorLog('✅ Both servers started successfully!', 'green');
    colorLog('', 'reset');
    colorLog(`🌐 Frontend: http://localhost:${CONFIG.frontendPort}`, 'cyan');
    colorLog(`🔧 Backend:  http://localhost:${CONFIG.backendPort}`, 'cyan');
    colorLog('', 'reset');
    colorLog('Press Ctrl+C to stop both servers', 'yellow');
    colorLog('', 'reset');
    
    // Handle cleanup on exit
    function cleanup() {
      colorLog('\n🛑 Stopping servers...', 'yellow');
      
      if (backendServer) {
        backendServer.kill();
        colorLog('Backend server stopped', 'green');
      }
      
      if (frontendServer) {
        frontendServer.kill();
        colorLog('Frontend server stopped', 'green');
      }
      
      colorLog('All servers stopped. Goodbye! 👋', 'green');
      process.exit(0);
    }
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
    // Keep the script running
    process.stdin.resume();
    
  } catch (error) {
    colorLog(`Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run the main function
main().catch(console.error);