import React, { useState } from 'react';
import { X, Server, User, Lock, Folder, Network } from 'lucide-react';
import { SMBConnection } from '@/types';
import { libraryService } from '@/services/libraryService';
import { useAppStore } from '@/store';

interface SMBConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (connection: SMBConnection) => void;
}

export const SMBConnectionModal: React.FC<SMBConnectionModalProps> = ({
  isOpen,
  onClose,
  onConnect,
}) => {
  const [formData, setFormData] = useState<SMBConnection>({
    host: '',
    port: 445,
    username: '',
    password: '',
    share: '',
    path: '',
  });

  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (field: keyof SMBConnection, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleTestConnection = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const success = await libraryService.connectSMB(formData);
      if (success) {
        setError('Connection successful!');
      } else {
        setError('Connection failed. Please check your credentials.');
      }
    } catch (err) {
      setError('Connection failed. Please check your network settings.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnect = () => {
    if (!formData.host || !formData.username || !formData.password || !formData.share) {
      setError('Please fill in all required fields.');
      return;
    }

    onConnect(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Network className="w-5 h-5 text-primary-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Connect to SMB Share
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Host */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Server className="w-4 h-4 inline mr-1" />
              Host
            </label>
            <input
              type="text"
              value={formData.host}
              onChange={(e) => handleInputChange('host', e.target.value)}
              placeholder="192.168.1.100 or server.local"
              className="input"
            />
          </div>

          {/* Port */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Port
            </label>
            <input
              type="number"
              value={formData.port}
              onChange={(e) => handleInputChange('port', parseInt(e.target.value))}
              placeholder="445"
              className="input"
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <User className="w-4 h-4 inline mr-1" />
              Username
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              placeholder="Enter username"
              className="input"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Lock className="w-4 h-4 inline mr-1" />
              Password
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              placeholder="Enter password"
              className="input"
            />
          </div>

          {/* Share */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Folder className="w-4 h-4 inline mr-1" />
              Share Name
            </label>
            <input
              type="text"
              value={formData.share}
              onChange={(e) => handleInputChange('share', e.target.value)}
              placeholder="files or shared"
              className="input"
            />
          </div>

          {/* Path (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Path (optional)
            </label>
            <input
              type="text"
              value={formData.path}
              onChange={(e) => handleInputChange('path', e.target.value)}
              placeholder="/subfolder"
              className="input"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className={`p-3 rounded-lg text-sm ${
              error.includes('successful') 
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
            }`}>
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              onClick={handleTestConnection}
              disabled={isConnecting}
              className="flex-1 btn btn-secondary"
            >
              {isConnecting ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              onClick={handleConnect}
              className="flex-1 btn btn-primary"
            >
              Connect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 