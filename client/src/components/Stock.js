import React, { useState, useEffect, useMemo, useCallback, useContext, useRef } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Filter, RefreshCw, Eye, Edit, Trash2, Plus, Download, Upload, BarChart3, TrendingUp, Package, AlertTriangle, ArrowDownWideNarrow, ArrowUpNarrowWide, ShoppingCart as Cart, Clock, Bookmark, X } from 'lucide-react';
import { AuthContext } from '../AuthContext';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';
import { QrReader } from 'react-qr-reader';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import CustomModal from './CustomModal';
import useCustomModal from '../hooks/useCustomModal';
import rateLimitManager from '../utils/rateLimitManager';

// Table styles
const tableStyles = `
  .pos-stock-table-container {
    background: var(--card-bg);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 16px var(--shadow-md);
  }

  :root[data-theme="light"] .pos-stock-table-container {
    background: var(--bg-secondary);
    box-shadow: 0 4px 16px var(--shadow-md);
  }

  :root[data-theme="dark"] .pos-stock-table-container {
    background: #1a1a1a;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  }

  .pos-stock-table-wrapper {
    overflow-x: auto;
    max-width: 100%;
    background: var(--bg-primary);
  }

  :root[data-theme="light"] .pos-stock-table-wrapper {
    background: var(--bg-primary);
  }

  :root[data-theme="dark"] .pos-stock-table-wrapper {
    background: transparent;
  }

  /* Scrollbar styles for table wrapper */
  .pos-stock-table-wrapper::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .pos-stock-table-wrapper::-webkit-scrollbar-track {
    background: var(--bg-secondary);
  }

  :root[data-theme="light"] .pos-stock-table-wrapper::-webkit-scrollbar-track {
    background: #e9ecef;
  }

  :root[data-theme="dark"] .pos-stock-table-wrapper::-webkit-scrollbar-track {
    background: #1a1a1a;
  }

  .pos-stock-table-wrapper::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 4px;
  }

  :root[data-theme="light"] .pos-stock-table-wrapper::-webkit-scrollbar-thumb {
    background: #adb5bd;
  }

  :root[data-theme="dark"] .pos-stock-table-wrapper::-webkit-scrollbar-thumb {
    background: #444;
  }

  .pos-stock-table-wrapper::-webkit-scrollbar-thumb:hover {
    background: var(--text-muted);
  }

  :root[data-theme="light"] .pos-stock-table-wrapper::-webkit-scrollbar-thumb:hover {
    background: #6c757d;
  }

  :root[data-theme="dark"] .pos-stock-table-wrapper::-webkit-scrollbar-thumb:hover {
    background: #555;
  }

  .pos-stock-table {
    width: 100%;
    border-collapse: collapse;
    background: var(--card-bg);
    color: var(--text-primary);
  }

  :root[data-theme="light"] .pos-stock-table {
    background: var(--bg-secondary);
  }

  :root[data-theme="dark"] .pos-stock-table {
    background: #1a1a1a;
    color: #e0e0e0;
  }

  .pos-stock-table th {
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-weight: 600;
    padding: 16px 20px;
    text-align: left;
    border-bottom: 2px solid var(--border-color);
    font-size: 1em;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    position: sticky;
    top: 0;
    z-index: 10;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  /* Specific column padding overrides */
  .pos-stock-table th:nth-child(2) {
    padding-right: 4px !important;
  }
  .pos-stock-table th:nth-child(3) {
    padding: 16px 8px 16px 4px !important;
  }
  .pos-stock-table th:nth-child(4) {
    padding: 16px 8px !important;
  }
  .pos-stock-table td:nth-child(2) {
    padding-right: 4px !important;
  }
  .pos-stock-table td:nth-child(3) {
    padding: 14px 8px 14px 4px !important;
    color: #ffc107 !important;
  }
  .pos-stock-table td:nth-child(4) {
    padding: 14px 8px !important;
  }

  :root[data-theme="light"] .pos-stock-table th {
    background: #e9ecef;
    color: #212529;
    border-bottom: 2px solid #dee2e6;
  }

  :root[data-theme="dark"] .pos-stock-table th {
    background: #2d2d2d;
    color: #ffffff;
    border-bottom: 2px solid #404040;
  }

  .pos-stock-table td {
    padding: 14px 20px;
    border-bottom: 1px solid var(--border-color);
    vertical-align: middle;
  }

  :root[data-theme="dark"] .pos-stock-table td {
    border-bottom: 1px solid #333;
  }
  
  .pos-stock-cell {
    font-size: 0.95em;
    font-weight: bold;
  }

  .pos-stock-row {
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    margin-bottom: 2px;
  }

  .pos-stock-row:hover {
    background: var(--hover-bg);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }

  .pos-stock-row.selected {
    box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
  }

  :root[data-theme="dark"] .pos-stock-row:hover {
    background: #2a2a2a;
  }

  .pos-stock-row.selected {
    background-color: rgba(76, 175, 80, 0.15) !important;
    border-left: 3px solid #4CAF50 !important;
  }

  .pos-stock-row.selected:hover {
    background-color: rgba(76, 175, 80, 0.25) !important;
  }

  .pos-stock-row.out-of-stock {
    opacity: 0.7;
    background: rgba(220, 53, 69, 0.1);
  }

  .pos-stock-row.out-of-stock:hover {
    background: rgba(220, 53, 69, 0.2);
  }

  .pos-stock-row.in-service {
    background-color: rgba(255, 193, 7, 0.15) !important;
    border-left: 3px solid #f59e0b !important;
  }

  .pos-stock-row.in-service:hover {
    background-color: rgba(255, 193, 7, 0.25) !important;
  }

  .pos-stock-cell {
    font-size: 0.9em;
  }

  .description-cell {
    max-width: 250px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .description-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .benz-numbers {
    display: flex;
    flex-direction: column;
    gap: 2px;
    white-space: nowrap;
    overflow: hidden;
    min-width: 0;
  }

  .benz-secondary {
    font-size: 0.8em;
    color: var(--text-muted);
  }
  
  .benz-primary-match {
    background: linear-gradient(135deg, #4CAF50, #45a049);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
  }
  
  .benz-secondary-match {
    background: linear-gradient(135deg, #FF9800, #F57C00);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
  }
  
  .benz-tertiary-match {
    background: linear-gradient(135deg, #2196F3, #1976D2);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
  }
  
  .match-indicator {
    margin-left: 4px;
    font-size: 0.8em;
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }

  .quantity-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 0.85em;
    background: #28a745;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 6px rgba(40, 167, 69, 0.3);
  }

  .quantity-badge:hover {
    transform: scale(1.1) translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  }

  .quantity-badge.low-stock {
    background: #ffc107;
    color: #212529;
    box-shadow: 0 2px 6px rgba(255, 193, 7, 0.4);
  }

  .quantity-badge.out-of-stock {
    box-shadow: 0 2px 6px rgba(220, 53, 69, 0.4);
  }

  .quantity-badge.in-stock {
    box-shadow: 0 2px 6px rgba(40, 167, 69, 0.3);
  }

  .status-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 0.8em;
    text-transform: uppercase;
  }

  .status-badge.in-stock {
    background: #28a745;
    color: white;
  }

  .status-badge.out-of-stock {
    background: #dc3545;
    color: white;
  }

  .actions-cell {
    text-align: center;
  }

  .pos-stock-action-btn {
    background: #007bff;
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.7em;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    min-width: auto;
    white-space: nowrap;
    height: 26px;
    box-shadow: 0 2px 6px rgba(0, 123, 255, 0.3);
  }

  .pos-stock-action-btn:hover {
    background: #0056b3;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 123, 255, 0.5);
  }

  .pos-stock-action-btn .pos-btn-icon {
    width: 14px;
    height: 14px;
  }

  .pos-stock-action-btn.active {
    background: #28a745 !important;
    color: white !important;
    border: 1px solid #28a745 !important;
  }

  .pos-stock-action-btn.active:hover {
    background: #218838 !important;
  }

  .pos-checkbox {
    accent-color: #1976d2;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 2px solid #1976d2;
    background: #fff;
    vertical-align: middle;
    margin: 0 4px;
    transition: box-shadow 0.2s;
    box-shadow: 0 1px 2px rgba(25, 118, 210, 0.08);
  }
  .pos-checkbox:focus {
    outline: 2px solid #1976d2;
    outline-offset: 1px;
  }
  /* Cart/side modal styles */
  .pos-cart-modal {
    position: fixed;
    top: 0;
    right: 0;
    width: 280px;
    height: 100vh;
    background: var(--modal-bg);
    color: var(--text-primary);
    z-index: 3000;
    display: flex;
    flex-direction: column;
    border-left: 1.5px solid var(--border-color);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
    border-radius: 0 10px 10px 0;
    transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    overflow: hidden;
    transform: translateX(0);
    opacity: 1;
    animation: cartSlideIn 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }

  :root[data-theme="light"] .pos-cart-modal {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border-left: 1.5px solid var(--border-color);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05);
  }

  :root[data-theme="dark"] .pos-cart-modal {
    background: rgba(26, 26, 26, 1);
    color: #fff;
    border-left: 1.5px solid rgba(45, 45, 45, 0.6);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05);
  }
  
  @keyframes cartSlideIn {
    0% {
      transform: translateX(100%);
      opacity: 0;
    }
    100% {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  .pos-cart-modal.minimized {
    width: 60px;
    height: 60px;
    top: auto;
    bottom: 20px;
    right: 20px;
    left: auto;
    border-radius: 50%;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary) !important;
    box-shadow: 0 2px 8px var(--shadow-md) !important;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transform: scale(1);
    opacity: 1;
    transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    overflow: visible;
  }

  :root[data-theme="dark"] .pos-cart-modal.minimized {
    border: 1px solid #404040;
    background: #2d2d2d !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
  }
  
  .pos-cart-modal.minimized .pos-cart-modal-header {
    padding: 0;
    justify-content: center;
    align-items: center;
    border: none;
    background: transparent !important;
    width: 100%;
    height: 100%;
  }
  
  .pos-cart-modal.minimized .pos-cart-modal-header .cart-title {
    display: none;
  }
  
  .pos-cart-modal.minimized .pos-cart-list,
  .pos-cart-modal.minimized .pos-cart-modal-footer {
    display: none;
  }
  
  .pos-cart-modal.minimized .cart-minimize-btn {
    display: none;
  }
  
  .pos-cart-modal.minimized .cart-maximize-btn {
    display: block;
  }
  
  .pos-cart-modal.minimized .pos-cart-modal-close {
    display: none;
  }
  
  .cart-item-count {
    position: absolute;
    top: -6px;
    right: -6px;
    background: #ff4444;
    color: white;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: bold;
    z-index: 1000;
    border: 2px solid var(--bg-primary);
    box-shadow: 0 2px 8px rgba(255, 68, 68, 0.5), 0 0 0 2px rgba(255, 68, 68, 0.2);
    transition: all 0.2s ease;
  }

  .cart-item-count:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(255, 68, 68, 0.6), 0 0 0 3px rgba(255, 68, 68, 0.3);
  }
  
  .cart-minimize-btn {
    background: none;
    border: none;
    color: var(--cart-title-color);
    font-size: 24px;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s ease;
    border-radius: 4px;
  }

  :root[data-theme="light"] {
    --cart-title-color: #1565c0;
    --cart-id-color: #b8860b;
  }

  :root[data-theme="dark"] {
    --cart-title-color: #90caf9;
    --cart-id-color: #ffd700;
  }

  .cart-title,
  .cart-title-text,
  [class*="cart"] h3,
  [class*="cart"] h4 {
    color: var(--cart-title-color) !important;
  }

  .cart-id-text {
    color: var(--cart-id-color);
  }
  
  .cart-maximize-btn {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    font-size: 18px;
    cursor: pointer;
    padding: 12px;
    border-radius: 8px;
    width: 60px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    box-shadow: 0 2px 8px var(--shadow-md);
    transform: scale(1);
  }

  :root[data-theme="dark"] .cart-maximize-btn {
    background: #2d2d2d;
    border: 1px solid #404040;
    color: #e0e0e0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  
  .cart-minimize-btn:hover {
    color: #1976d2;
    background: rgba(25, 118, 210, 0.1);
  }
  
  .cart-maximize-btn:hover {
    background: var(--hover-bg);
    border-color: #1976d2;
    color: #1976d2;
    transform: scale(1.05);
    box-shadow: 0 4px 12px var(--shadow-lg);
  }

  :root[data-theme="dark"] .cart-maximize-btn:hover {
    background: #404040;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  
  .cart-maximize-btn:active {
    transform: scale(0.95);
    transition: all 0.1s ease;
  }
  
  .cart-maximize-btn {
    display: none;
  }
  .pos-cart-modal-header {
    padding: 16px 18px 10px 18px;
    font-size: 0.98em;
    font-weight: 500;
    border-bottom: 1px solid var(--border-color);
    background: var(--modal-bg);
    display: flex;
    justify-content: space-between;
    align-items: center;
    letter-spacing: 0.5px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  :root[data-theme="light"] .pos-cart-modal-header {
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  :root[data-theme="dark"] .pos-cart-modal-header {
    border-bottom: 1px solid rgba(45, 45, 45, 0.6);
    background: rgba(26, 26, 26, 1);
  }

  .pos-cart-modal-close {
    background: none;
    border: none;
    color: var(--text-primary);
    font-size: 1.3em;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    cursor: pointer;
    transition: background 0.2s;
  }

  :root[data-theme="dark"] .pos-cart-modal-close {
    color: #fff;
  }

  .pos-cart-modal-close:hover {
    background: #1976d2;
    color: #fff;
    box-shadow: 0 2px 8px rgba(25, 118, 210, 0.4);
    transform: scale(1.1);
  }

  .pos-cart-list {
    flex: 1;
    overflow-y: auto;
    padding: 14px 18px 10px 18px;
    background: var(--modal-bg);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  :root[data-theme="light"] .pos-cart-list {
    background: var(--bg-secondary);
  }

  :root[data-theme="dark"] .pos-cart-list {
    background: rgba(26, 26, 26, 1);
  }

  .pos-cart-item {
    background: var(--card-bg);
    border-radius: 8px;
    padding: 10px 12px 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
    border: 1px solid var(--border-color);
    transition: all 0.2s ease;
  }

  .pos-cart-item:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 6px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);
  }

  @keyframes cartItemAdded {
    0% {
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
      border-left: 4px solid rgba(40, 167, 69, 0);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
    }
    15% {
      opacity: 0.7;
      transform: translateY(-10px) scale(0.97);
      border-left: 4px solid rgba(40, 167, 69, 1);
      box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3), 0 2px 6px rgba(0, 0, 0, 0.15);
    }
    40% {
      opacity: 1;
      transform: translateY(3px) scale(1.03);
      border-left: 4px solid rgba(40, 167, 69, 0.9);
      box-shadow: 0 6px 16px rgba(40, 167, 69, 0.4), 0 3px 8px rgba(0, 0, 0, 0.2);
      background-color: rgba(40, 167, 69, 0.15);
    }
    70% {
      transform: translateY(-1px) scale(1.01);
      border-left: 4px solid rgba(40, 167, 69, 0.5);
      box-shadow: 0 4px 12px rgba(40, 167, 69, 0.2), 0 2px 6px rgba(0, 0, 0, 0.15);
      background-color: rgba(40, 167, 69, 0.08);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
      border-left: 4px solid rgba(40, 167, 69, 0);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
      background-color: var(--card-bg);
    }
  }

  .cart-item-just-added {
    animation: cartItemAdded 0.7s ease-out forwards !important;
    position: relative;
  }

  :root[data-theme="light"] .pos-cart-item {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  :root[data-theme="dark"] .pos-cart-item {
    background: #23272f;
    border: 1px solid #2d2d2d;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .pos-cart-item-title {
    font-weight: bold;
    font-size: 1em;
    color: #1976d2;
    margin-bottom: 1px;
  }

  .pos-cart-item-desc {
    font-size: 0.97em;
    color: var(--text-secondary);
    opacity: 0.92;
  }

  :root[data-theme="dark"] .pos-cart-item-desc {
    color: #e0e0e0;
  }

  .pos-cart-modal-footer {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 14px 18px 14px 18px;
    background: var(--modal-bg);
    border-top: 1px solid var(--border-color);
    position: static;
    bottom: 0;
    z-index: 2;
  }

  :root[data-theme="light"] .pos-cart-modal-footer {
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-color);
  }

  :root[data-theme="dark"] .pos-cart-modal-footer {
    background: rgba(26, 26, 26, 1);
    border-top: 1px solid rgba(45, 45, 45, 0.6);
  }
  .pos-cart-modal-footer button {
    border: 1.5px solid #1976d2;
    color: #1976d2;
    background: transparent;
    border-radius: 6px;
    padding: 8px 18px;
    font-weight: 600;
    font-size: 1em;
    min-width: 110px;
    transition: all 0.2s ease;
    margin: 0 2px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  .pos-cart-modal-footer button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }
  .pos-cart-modal-footer button:last-child {
    border-color: #dc3545;
    color: #dc3545;
    box-shadow: 0 2px 4px rgba(220, 53, 69, 0.2);
  }
  .pos-cart-modal-footer button:last-child:hover {
    background: rgba(220,53,69,0.08);
    color: #fff;
    border-color: #dc3545;
    box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4);
    transform: translateY(-2px);
  }
  .pos-cart-modal-footer button:hover {
    background: #1976d2;
    color: #fff;
    border-color: #1976d2;
    box-shadow: 0 4px 12px rgba(25, 118, 210, 0.4);
    transform: translateY(-2px);
  }

  /* Barcode Scanner Button Styles */
  .pos-barcode-scanner-btn {
    background: linear-gradient(135deg, #4caf50, #45a049) !important;
    border-color: #4caf50 !important;
    color: #fff !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    transition: all 0.3s ease !important;
  }

  .pos-barcode-scanner-btn:hover {
    background: linear-gradient(135deg, #45a049, #3d8b40) !important;
    border-color: #45a049 !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3) !important;
  }

  .pos-barcode-scanner-btn svg {
    flex-shrink: 0;
  }

  /* Export Excel Button Styles */
  .pos-export-excel-btn {
    background: linear-gradient(135deg, #ff9800, #f57c00) !important;
    border-color: #ff9800 !important;
    color: #fff !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    transition: all 0.3s ease !important;
  }

  .pos-export-excel-btn:hover {
    background: linear-gradient(135deg, #f57c00, #ef6c00) !important;
    border-color: #f57c00 !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 4px 12px rgba(255, 152, 0, 0.3) !important;
  }

  /* Import CSV Button Styles */
  .pos-import-csv-btn {
    background: linear-gradient(135deg, #9c27b0, #7b1fa2) !important;
    border-color: #9c27b0 !important;
    color: #fff !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    transition: all 0.3s ease !important;
  }

  .pos-import-csv-btn:hover {
    background: linear-gradient(135deg, #7b1fa2, #6a1b9a) !important;
    border-color: #7b1fa2 !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 4px 12px rgba(156, 39, 176, 0.3) !important;
  }

  .pos-import-csv-btn svg {
    flex-shrink: 0;
  }

  .pos-export-excel-btn svg {
    flex-shrink: 0;
  }

  .export-info-text {
    font-size: 0.75rem;
    color: #666;
    text-align: center;
    margin-top: 4px;
    font-style: italic;
  }

  /* Export Preview Modal Styles */
  .export-preview-modal {
    max-width: 90vw;
    width: 800px;
    max-height: 90vh;
  }

  .export-preview-info {
    margin-bottom: 20px;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #e9ecef;
  }

  .export-preview-info p {
    margin: 5px 0;
    color: #495057;
  }

  .export-preview-table-container {
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid #dee2e6;
    border-radius: 8px;
  }

  .export-preview-table {
    width: 100%;
    border-collapse: collapse;
    background: white;
  }

  .export-preview-table th,
  .export-preview-table td {
    padding: 12px;
    text-align: left;
    border: 1px solid #dee2e6;
  }

  .export-preview-table th {
    background: #e9ecef;
    font-weight: 600;
    color: #495057;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .export-preview-table td {
    color: #212529;
  }

  .export-preview-table tbody tr:nth-child(even) {
    background: #f8f9fa;
  }

  .export-preview-table tbody tr:hover {
    background: #e9ecef;
  }

  .export-preview-table button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .export-preview-table .actions-column {
    width: 100px;
    text-align: center;
  }

  .export-preview-table .delete-btn {
    background: #dc3545 !important;
    border-color: #dc3545 !important;
    color: white !important;
    padding: 4px 8px !important;
    font-size: 12px !important;
    border-radius: 4px !important;
    transition: all 0.2s ease !important;
  }

  .export-preview-table .delete-btn:hover {
    background: #c82333 !important;
    border-color: #c82333 !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 2px 4px rgba(220, 53, 69, 0.3) !important;
  }

  .pos-modal-body {
    padding: 20px;
    max-height: 60vh;
    overflow-y: auto;
  }

  /* Search and Filter Controls */
  .pos-search-container {
    position: relative;
  }

  .pos-search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    width: 16px;
    height: 16px;
    z-index: 1;
  }

  .pos-search-input {
    width: 100%;
    padding: 10px 12px 10px 38px;
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 13px;
    outline: none;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  }

  .pos-search-input:focus {
    border-color: #007bff;
    box-shadow: 0 4px 8px rgba(0, 123, 255, 0.2);
  }

  .pos-search-input::placeholder {
    color: var(--text-muted);
  }

  .pos-filter-container {
    position: relative;
    display: flex;
    align-items: center;
  }

  .pos-filter-icon {
    position: absolute;
    left: 12px;
    color: var(--text-muted);
    width: 16px;
    height: 16px;
    z-index: 1;
    pointer-events: none;
  }

  .pos-filter-select {
    padding: 10px 12px 10px 38px;
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 13px;
    outline: none;
    cursor: pointer;
    transition: all 0.2s ease;
    appearance: none;
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
    background-position: right 8px center;
    background-repeat: no-repeat;
    background-size: 16px;
    padding-right: 36px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  }

  .pos-filter-select:focus {
    border-color: #007bff;
    box-shadow: 0 4px 8px rgba(0, 123, 255, 0.2);
  }

  .pos-filter-select option {
    background: var(--input-bg);
    color: var(--text-primary);
  }

  @media (max-width: 600px) {
    .pos-cart-modal {
      width: 100vw;
      max-width: 100vw;
      border-radius: 0;
      padding: 0;
      left: 0;
      right: 0;
    }
    .pos-cart-modal-header, .pos-cart-list {
      padding-left: 12px;
      padding-right: 12px;
    }
    .pos-cart-modal-footer {
      padding: 12px;
    }
  }

  @media (max-width: 428px) {
    /* iPhone 13 Pro Max and similar */
    .pos-stock-controls {
      flex-direction: column;
      gap: 12px;
      align-items: stretch;
    }
    
    .pos-search-container {
      max-width: 100% !important;
    }
    
    .pos-stock-action-btn {
      padding: 12px 16px !important;
      font-size: 14px !important;
      min-height: 44px;
    }
    
    .pos-stock-table th,
    .pos-stock-table td {
      padding: 8px 6px;
      font-size: 12px;
      white-space: nowrap;
    }
    
    .description-cell {
      max-width: 120px;
    }
    
    .description-text {
      font-size: 11px;
    }
  }

  @media (max-width: 390px) {
    /* iPhone 13 and similar */
    .pos-stock-table th,
    .pos-stock-table td {
      padding: 6px 4px;
      font-size: 11px;
    }
    
    .pos-stock-action-btn {
      padding: 10px 12px !important;
      font-size: 12px !important;
    }
    
    .description-cell {
      max-width: 100px;
    }
  }

  @media (max-width: 768px) {
    .pos-stock-table th,
    .pos-stock-table td {
      padding: 8px 12px;
      font-size: 0.8em;
    }
    
    .description-cell {
      max-width: 150px;
    }
  }
  

`;

  // Debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// Brand detection function
const checkIfBrandSearch = (searchTerm, brandList) => {
  if (!searchTerm || !brandList || brandList.length === 0) return false;
  
  const cleanSearchTerm = searchTerm.toLowerCase().trim();
  return brandList.some(brand => 
    brand.toLowerCase().includes(cleanSearchTerm) || 
    cleanSearchTerm.includes(brand.toLowerCase())
  );
};

// Service integration function
const getServiceInfo = (stockId, serviceData) => {
  if (!serviceData || !serviceData[stockId]) return null;
  
  const service = serviceData[stockId];
  return {
    isInService: true,
    totalQuantity: service.total_quantity,
    orderIds: service.order_ids,
    status: service.status,
    latestServiceDate: service.latest_service_date
  };
};

const SORT_OPTIONS = [
  { value: 'recent', label: 'Most Recent First' },
  { value: 'az', label: 'Brand A-Z' },
  { value: 'za', label: 'Brand Z-A' },
  { value: 'quantity-high', label: 'Quantity, high to low' },
  { value: 'quantity-low', label: 'Quantity, low to high' },
  { value: 'price-low', label: 'Price, low to high' },
  { value: 'price-high', label: 'Price, high to low' },
];

const Stock = () => {
  // Custom Modal Hook
  const { modalState, showAlert, showConfirm, closeModal } = useCustomModal();
  
  const navigate = useNavigate();
  const location = useLocation();
  
  // Large font mode state (shared across system, persisted in localStorage)
  // Stock.js should NOT respond to global font mode changes
  // Font size is fixed for Stock page to maintain consistent layout
  const largeFontMode = false; // Always false for Stock page
  const getFontSize = (baseSize) => {
    return baseSize; // Always return base size, no scaling
  };
  
  // Check if we're in "Add to Order" mode
  const searchParams = new URLSearchParams(location.search);
  const addToOrderId = searchParams.get('addToOrder');
  
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('in-stock');
  const [serviceData, setServiceData] = useState({});

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage] = useState(300);
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  const [showModal, setShowModal] = useState(false);
  const [editingStock, setEditingStock] = useState(null);
  const [modalForm, setModalForm] = useState({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [stats, setStats] = useState({
    totalItems: 0,
    inStock: 0,
    outOfStock: 0,
    totalValue: 0
  });
  const [sortDropdown, setSortDropdown] = useState('recent'); // Default to most recent first
  const [showRecentSort, setShowRecentSort] = useState(false); // Track if recent button was clicked
  const [showingRecentItems, setShowingRecentItems] = useState(false); // Track if we're showing recent items view
  const [master, setMaster] = useState([]); // <-- Add master data
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestingStock, setRequestingStock] = useState(null);
  const [requestReason, setRequestReason] = useState('');
  const { user } = useContext(AuthContext);

  // Add state for scan modal and scanned value
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scannedValue, setScannedValue] = useState('');
  // Change selectedStocks to store stock objects, not just IDs
  const [selectedStocks, setSelectedStocks] = useState([]);
  const [lastAddedToCartId, setLastAddedToCartId] = useState(null);

  const [cartOpen, setCartOpen] = useState(true); // Default to open
  const [orderId, setOrderId] = useState(null);
  const [orderNumber, setOrderNumber] = useState(null);
  
  // Hold Order feature - store held orders
  const [heldOrders, setHeldOrders] = useState(() => {
    const saved = localStorage.getItem('stockHeldOrders');
    return saved ? JSON.parse(saved) : [];
  });
  const [showHeldOrdersModal, setShowHeldOrdersModal] = useState(false);
  const [showHoldOrderModal, setShowHoldOrderModal] = useState(false);
  const [holdOrderCustomerName, setHoldOrderCustomerName] = useState('');
  const [customerNameSuggestions, setCustomerNameSuggestions] = useState(() => {
    const saved = localStorage.getItem('stockCustomerNames');
    return saved ? JSON.parse(saved) : [];
  });
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  
  // Item movement modal state
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementData, setMovementData] = useState([]);
  const [movementLoading, setMovementLoading] = useState(false);
  const [movementBenz, setMovementBenz] = useState('');
  const [movementBrand, setMovementBrand] = useState('');
  const [movementAltno, setMovementAltno] = useState('');
  const [movementDescription, setMovementDescription] = useState('');
  const [movementApplication, setMovementApplication] = useState('');
  const [movementStockQuantity, setMovementStockQuantity] = useState(0);
  const [filterYear, setFilterYear] = useState('');
  const [filterMonths, setFilterMonths] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  
  // Save held orders to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('stockHeldOrders', JSON.stringify(heldOrders));
  }, [heldOrders]);
  
  // Save customer names to localStorage
  useEffect(() => {
    if (customerNameSuggestions.length > 0) {
      localStorage.setItem('stockCustomerNames', JSON.stringify(customerNameSuggestions));
    }
  }, [customerNameSuggestions]);
  
  // Filter customer name suggestions based on input
  const filteredCustomerSuggestions = holdOrderCustomerName.trim()
    ? customerNameSuggestions.filter(name => 
        name.toLowerCase().includes(holdOrderCustomerName.toLowerCase())
      )
    : customerNameSuggestions;
  
  // Handle Hold Order - show modal to enter customer name
  const handleHoldOrder = () => {
    if (selectedStocks.length === 0) {
      showNotification('warning', 'No Items', 'Your cart is empty. Add items before holding an order.');
      return;
    }
    setShowHoldOrderModal(true);
  };
  
  // Confirm Hold Order with customer name
  const handleConfirmHoldOrder = () => {
    if (!holdOrderCustomerName || !holdOrderCustomerName.trim()) {
      showNotification('warning', 'Customer Name Required', 'Please enter customer name to hold the order.');
      return;
    }
    
    const itemCount = selectedStocks.length; // Save count before clearing
    const itemsToHold = [...selectedStocks]; // Save items before clearing
    const customerName = holdOrderCustomerName.trim().toUpperCase();
    
    // Add customer name to suggestions if not already there
    if (!customerNameSuggestions.includes(customerName)) {
      setCustomerNameSuggestions(prev => [...prev, customerName].slice(-50)); // Keep last 50
    }
    
    // Generate order number if not exists
    const heldOrderNumber = orderNumber || `HELD-${Date.now()}`;
    
    const newHeldOrder = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      items: itemsToHold, // Save all items with quantities and prices
      orderNumber: heldOrderNumber,
      orderId: orderId,
      customerName: customerName
    };
    
    setHeldOrders(prev => [...prev, newHeldOrder]);
    
    // Clear current cart
    setSelectedStocks([]);
    setOrderNumber(null);
    setOrderId(null);
    setHoldOrderCustomerName('');
    setShowHoldOrderModal(false);
    
    showNotification('success', 'Order Held', `Order has been held for ${customerName}. You can restore it later. (${itemCount} items)`);
  };
  
  // Handle Restore Order - load a held order back to cart
  const handleRestoreOrder = (heldOrder) => {
    if (selectedStocks.length > 0) {
      showNotification('warning', 'Cart Not Empty', 'Please clear your current cart before restoring a held order.', () => {
        setSelectedStocks(heldOrder.items);
        setOrderNumber(heldOrder.orderNumber);
        setOrderId(heldOrder.orderId);
        setShowHeldOrdersModal(false);
      }, true);
    } else {
      setSelectedStocks(heldOrder.items);
      setOrderNumber(heldOrder.orderNumber);
      setOrderId(heldOrder.orderId);
      setShowHeldOrdersModal(false);
      showNotification('success', 'Order Restored', `Restored order for ${heldOrder.customerName || 'Customer'} with ${heldOrder.items.length} items.`);
    }
  };
  
  // Handle Delete Held Order
  const handleDeleteHeldOrder = (orderId) => {
    setHeldOrders(prev => prev.filter(order => order.id !== orderId));
    showNotification('success', 'Order Deleted', 'Held order has been deleted.');
  };
  const [quotationModalOpen, setQuotationModalOpen] = useState(false);
  const [quotationForm, setQuotationForm] = useState({
    customer_name: '',
    chassis_number: '',
    contact_number: ''
  });
  const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);
  const [warehouseCustomerName, setWarehouseCustomerName] = useState('');
  const [returnedOrderNotification, setReturnedOrderNotification] = useState(null);
  
  // Add state for price editing
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [returnedOrderModal, setReturnedOrderModal] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef(null);
  
  // Navigation guard - prevent leaving when cart has items
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (selectedStocks.length > 0) {
        e.preventDefault();
        e.returnValue = 'You have items in your cart. Are you sure you want to leave? Your cart will be cleared.';
        return 'You have items in your cart. Are you sure you want to leave? Your cart will be cleared.';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [selectedStocks.length]);

  // Update localStorage when selectedStocks changes
  useEffect(() => {
    if (selectedStocks.length > 0) {
      localStorage.setItem('inventoryCartCount', selectedStocks.length.toString());
      localStorage.setItem('inventoryCartPage', location.pathname);
    } else {
      localStorage.removeItem('inventoryCartCount');
      localStorage.removeItem('inventoryCartPage');
    }
  }, [selectedStocks.length, location.pathname]);

  // Block navigation when cart has items (simplified without history manipulation)
  useEffect(() => {
    const handlePopState = (e) => {
      if (selectedStocks.length > 0) {
        // Show existing navigation warning modal
        setPendingNavigation('back');
        setShowNavigationWarning(true);
      }
    };

    // Listen for browser back/forward button
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedStocks.length]);

  // Listen for navigation confirmation events from POSLayout
  useEffect(() => {
    const handleNavigationConfirmEvent = (e) => {
      const { targetPath, cartCount } = e.detail;
      setPendingNavigation(targetPath);
      setShowNavigationWarning(true);
    };

    window.addEventListener('showNavigationConfirm', handleNavigationConfirmEvent);
    return () => window.removeEventListener('showNavigationConfirm', handleNavigationConfirmEvent);
  }, []);
  const [clearConfirmationData, setClearConfirmationData] = useState(null);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [cartMinimized, setCartMinimized] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [showNavigationWarning, setShowNavigationWarning] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationData, setNotificationData] = useState({
    type: 'success', // 'success', 'error', 'warning', 'info'
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'OK',
    showCancel: false,
    cancelText: 'Cancel'
  });

  // Check if cart has unsaved items
  const hasUnsavedCartItems = () => {
    return selectedStocks && selectedStocks.length > 0;
  };

  // Show formal notification modal instead of alert()
  const showNotification = (type, title, message, onConfirm = null, showCancel = false) => {
    setNotificationData({
      type,
      title,
      message,
      onConfirm,
      confirmText: onConfirm ? 'Confirm' : 'OK',
      showCancel,
      cancelText: 'Cancel'
    });
    setShowNotificationModal(true);
  };

  // Handle notification confirm
  const handleNotificationConfirm = () => {
    if (notificationData.onConfirm) {
      notificationData.onConfirm();
    }
    setShowNotificationModal(false);
  };

  // Handle notification cancel
  const handleNotificationCancel = () => {
    setShowNotificationModal(false);
  };

  // Handle navigation with cart warning
  const handleNavigationWithWarning = (navigationFunction) => {
    if (hasUnsavedCartItems()) {
      setPendingNavigation(() => navigationFunction);
      setShowNavigationWarning(true);
    } else {
      navigationFunction();
    }
  };

  // Confirm navigation and clear cart
  const confirmNavigation = () => {
    console.log('🧭 Confirming navigation and clearing cart...');
    
    // Clear all cart-related state
    setSelectedStocks([]);
    setCartOpen(false);
    setCartMinimized(false);
    setOrderNumber(null);
    
    // Explicitly clear localStorage to prevent POSLayout from blocking navigation
    localStorage.removeItem('inventoryCartCount');
    localStorage.removeItem('inventoryCartPage');
    
    // Clear navigation warning state
    setShowNavigationWarning(false);
    const navigationToExecute = pendingNavigation;
    setPendingNavigation(null);
    
    // Execute navigation after all state is cleared
    setTimeout(() => {
      if (navigationToExecute === 'back') {
        window.history.back();
      } else if (navigationToExecute && typeof navigationToExecute === 'string') {
        navigate(navigationToExecute);
      } else if (navigationToExecute && typeof navigationToExecute === 'function') {
        navigationToExecute();
      }
      console.log('🧭 Navigation completed, localStorage cleared');
    }, 150);
  };

  // Cancel navigation
  const cancelNavigation = () => {
    setShowNavigationWarning(false);
    setPendingNavigation(null);
  };

  // Show cart when items are selected
  useEffect(() => {
    console.log('🛒 Cart visibility check:', { selectedStocksLength: selectedStocks.length, selectedStocks });
    setCartOpen(selectedStocks.length > 0);
    
    // Auto-collapse sidebar when items are selected
    window.dispatchEvent(new CustomEvent('cartItemsSelected', { 
      detail: { hasItems: selectedStocks.length > 0 } 
    }));
  }, [selectedStocks]);

  // Load search term from URL on component mount and initial data
  useEffect(() => {
    const searchParam = new URLSearchParams(window.location.search).get('search');
    if (searchParam) {
      setSearchTerm(searchParam);
    }
    
    // If in "Add to Order" mode, automatically open the cart
    if (addToOrderId) {
      setCartOpen(true);
    }
    
    // Load initial data
    fetchStocks(1, '', 'in-stock', 'recent');
    // eslint-disable-next-line
  }, []);

  // Fetch brands for brand detection
  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/products/brands', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setBrands(response.data || []);
      } catch (error) {
        console.error('Error fetching brands:', error);
        setBrands([]);
      }
    };

    fetchBrands();
  }, []);

  // Fetch service data for stock items
  useEffect(() => {
    const fetchServiceData = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/service/stock-data', {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('🔧 Service data fetched:', response.data);
        setServiceData(response.data || {});
      } catch (error) {
        console.error('Error fetching service data:', error);
        setServiceData({});
      }
    };

    fetchServiceData();
  }, []);

  // Refresh service data when stocks are fetched
  useEffect(() => {
    if (stocks && stocks.length > 0) {
      const fetchServiceData = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get('/api/service/stock-data', {
            headers: { Authorization: `Bearer ${token}` }
          });
          console.log('🔧 Service data refreshed:', response.data);
          setServiceData(response.data || {});
        } catch (error) {
          console.error('Error refreshing service data:', error);
        }
      };

      fetchServiceData();
    }
  }, [stocks]);

  // When cart is opened for a new order, get the next order number
  useEffect(() => {
    const fetchNextOrderNumber = async () => {
      if (cartOpen && !orderNumber) {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get('/api/warehouse/next-order-number', {
            headers: { Authorization: `Bearer ${token}` }
          });
          setOrderNumber(response.data.next_order_number);
          setOrderId(response.data.next_order_number.toString()); // Keep orderId for compatibility
        } catch (error) {
          console.error('Error fetching next order number:', error);
          // Fallback to UUID if API fails
          setOrderId(uuidv4());
        }
      }
    };

    fetchNextOrderNumber();
  }, [cartOpen]);

  // Reset order number when cart is closed
  useEffect(() => {
    if (!cartOpen) {
      setOrderNumber(null);
      setOrderId(null);
    }
  }, [cartOpen]);

  const fetchStocks = useCallback(async (page = 1, search = '', filter = 'all', sort = 'recent', customLimit = null) => {
    // Prevent multiple simultaneous API calls using ref
    if (isFetchingRef.current) {
      console.log('🚫 Fetch already in progress, skipping...');
      return;
    }

    // Check rate limit manager
    if (!rateLimitManager.canMakeRequest()) {
      const waitTime = rateLimitManager.getTimeUntilCooldownEnds();
      console.log(`⏳ Rate limit cooldown active. Waiting ${waitTime / 1000}s...`);
      rateLimitManager.queueRequest(() => fetchStocks(page, search, filter, sort, customLimit));
      return;
    }

    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    try {
      isFetchingRef.current = true;
      setIsFetching(true);
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found. Please log in again.');
        return;
      }
      
      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: (customLimit || itemsPerPage).toString(),
        sort: sort
      });
      
      if (search.trim()) {
        params.append('search', search.trim());
      }
      
      // Always append filter parameter, including 'all' for all items
      params.append('filter', filter);
      
      // Add cache-busting parameter to ensure fresh data
      params.append('_t', Date.now().toString());
      
      const response = await axios.get(`/api/stock-items?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortController.signal
      });

      // Check if request was aborted
      if (abortController.signal.aborted) {
        return;
      }

      // Mark success in rate limit manager
      rateLimitManager.handleSuccess();
      
      console.log('Stock API Response:', response.data); // Debug log
      console.log('📊 API Response Details:');
      console.log('  - Filter used:', filter);
      console.log('  - Search term:', search);
      console.log('  - Total items from API:', response.data.data?.length || 0);
      console.log('  - Pagination total:', response.data.pagination?.total || 0);
      console.log('  - Current page:', response.data.pagination?.page || 0);
      
      // Debug: Check quantity distribution
      if (response.data.data && response.data.data.length > 0) {
        const quantities = response.data.data.map(item => parseInt(item.QTY) || 0);
        const zeroQty = quantities.filter(qty => qty === 0).length;
        const nonZeroQty = quantities.filter(qty => qty > 0).length;
        console.log('📊 Quantity Distribution:');
        console.log('  - Items with 0 quantity:', zeroQty);
        console.log('  - Items with >0 quantity:', nonZeroQty);
        console.log('  - Sample quantities:', quantities.slice(0, 10));
      }
      
      // Check if response data exists and has the expected structure
      if (!response.data || !response.data.data || !Array.isArray(response.data.data)) {
        console.error('Invalid response structure:', response.data);
        setError('Invalid response from server. Please try again.');
        setStocks([]);
        setCurrentPage(1);
        setTotalPages(1);
        setTotalItems(0);
        setStats({
          totalItems: 0,
          inStock: 0,
          outOfStock: 0,
          totalValue: 0
        });
        return;
      }
      
      console.log('Raw stock data sample:', response.data.data.slice(0, 3).map(s => ({ id: s.id, ID: s.ID, BENZ: s.BENZ, BRAND: s.BRAND })));
      
      // Store raw data directly - let mergedStocks handle the transformation
      setStocks(response.data.data);
      setCurrentPage(page);
      setTotalPages(response.data.pagination.pages);
      setTotalItems(response.data.pagination.total);
      
      // Update stats using raw data
      const inStockCount = response.data.data.filter(s => (parseInt(s.QTY) || 0) > 0).length;
      const outOfStockCount = response.data.data.filter(s => (parseInt(s.QTY) || 0) <= 0).length;
      const totalValue = response.data.data.reduce((sum, s) => sum + ((parseInt(s.QTY) || 0) * (parseFloat(s.SELL) || 0)), 0);
      
      setStats({
        totalItems: response.data.pagination.total,
        inStock: inStockCount,
        outOfStock: outOfStockCount,
        totalValue: totalValue
      });
      
    } catch (error) {
      // Ignore aborted requests
      if (axios.isCancel(error) || error.name === 'AbortError' || abortController.signal.aborted) {
        console.log('Request aborted');
        return;
      }

      console.error('Error fetching stocks:', error);
      
      // Handle 429 rate limit errors
      if (error.response?.status === 429) {
        const backoffDelay = rateLimitManager.handle429Error();
        const waitSeconds = Math.ceil(backoffDelay / 1000);
        setError(`Rate limit exceeded. Retrying in ${waitSeconds} seconds...`);
        
        // Queue the request to retry after cooldown
        rateLimitManager.queueRequest(() => fetchStocks(page, search, filter, sort, customLimit));
        return;
      }
      
      if (error.response?.status === 401) {
        setError('Authentication failed. Please log in again.');
      } else if (error.response?.status === 403) {
        setError('Your session has expired. Please log in again to continue.');
        // Clear token and redirect to login after a short delay
        setTimeout(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          navigate('/login');
        }, 2000);
      } else if (error.response?.status === 500) {
        setError(`Server error: ${error.response.data?.error || error.message}`);
      } else if (error.code === 'ECONNREFUSED') {
        setError('Cannot connect to server. Please check if the backend is running.');
      } else {
        setError(`Failed to fetch stocks: ${error.message}`);
      }
    } finally {
      setLoading(false);
      setIsFetching(false);
      isFetchingRef.current = false;
      abortControllerRef.current = null;
    }
  }, [itemsPerPage]);

  // Listen for returned order events (from warehouse page)
  useEffect(() => {
    const handler = async (e) => {
      const { orderId } = e.detail;
      // Fetch returned order items from backend
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/warehouse/items', { headers: { Authorization: `Bearer ${token}` } });
      const orderItems = res.data.filter(item => item.order_id === orderId);
      setReturnedOrderNotification({ orderId, items: orderItems });
      
      // Refresh stock data to show updated quantities after order return
      fetchStocks(currentPage, searchTerm, stockFilter, sortDropdown);
    };
    window.addEventListener('warehouseOrderReturned', handler);
    return () => window.removeEventListener('warehouseOrderReturned', handler);
  }, [currentPage, searchTerm, stockFilter, sortDropdown]); // Removed fetchStocks from dependencies

  // Debounced values - reduced delay for better responsiveness
  const debouncedSearchTerm = useDebounce(searchTerm, 150);
  const debouncedStockFilter = useDebounce(stockFilter, 150);

  // Load data when search term or filter changes
  useEffect(() => {
    // Always search when there's a search term, even if it's the same
    if (debouncedSearchTerm && debouncedSearchTerm.trim()) {
      fetchStocks(1, debouncedSearchTerm.trim(), stockFilter, sortDropdown);
    } else if (debouncedSearchTerm === '') {
      // Only load default data when search is explicitly empty
      fetchStocks(1, '', stockFilter, sortDropdown);
    }
  }, [debouncedSearchTerm, stockFilter, sortDropdown]); // Removed fetchStocks from dependencies

  // When sortDropdown changes, only update the sort, don't refetch
  // The main search useEffect will handle refetching with the new sort

  // Fetch master table data
  useEffect(() => {
    const fetchMaster = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/products?limit=all', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Check if response data exists and has the expected structure
        if (!response.data || !response.data.data || !Array.isArray(response.data.data)) {
          console.error('Invalid master response structure:', response.data);
          setMaster([]);
          return;
        }
        
        setMaster(response.data.data);
      } catch (err) {
        console.error('Failed to fetch master table:', err);
        setMaster([]);
      }
    };
    fetchMaster();
  }, []);



  // Merge stocks with master fallback logic and transform data
  const mergedStocks = useMemo(() => {
    if (!stocks || !Array.isArray(stocks) || !stocks.length) return [];
    
    let noDescriptionCount = 0;
    let noMatchCount = 0;
    let withDescriptionCount = 0;
    
    const result = stocks.map(stock => {
      // First, transform the raw stock data
      const transformedStock = {
        ID: stock.ID || stock.id,
        NAME: stock.BRAND || 'Unnamed Item',
        CODE: stock.ALTNO || stock.BENZ || 'No Code',
        PRICE: parseFloat(stock.SELL) || 0,
        COST: parseFloat(stock.COST) || 0,
        QUANTITY: parseInt(stock.QTY) || 0,
        BRAND: stock.BRAND || '',
        BENZ: stock.BENZ || '',
        BENZ2: stock.BENZ2 || '',
        BENZ3: stock.BENZ3 || '',
        ALTNO: stock.ALTNO || '',
        ALTNO2: stock.ALTNO2 || '',
        COLORCODE: stock.COLORCODE || '',
        REMARKS: stock.REMARKS || '',
        CURRENCY: stock.CURRENCY || '',
        DINFLAG: stock.DINFLAG || '',
        DESCRIPTION: stock.DESCRIPTION || stock.REMARKS || '',
        APPLICATION: stock.APPLICATION || stock.APPL || '',
        UNIT: stock.UNIT || '',
        DATE: stock.DATE || '',
        REFERENCE: stock.REFERENCE || '',
        OEM: stock.OEM || '',
        SELL: stock.SELL || '',
        FC_COST: stock.FC_COST || '',
        FCAMOUNT: stock.FCAMOUNT || '',
        CONVERSION: stock.CONVERSION || '',
        LOCATION: stock.LOCATION || '',
        QTY: stock.QTY || '',
        originalData: stock
      };
      
      // Then try to merge with master data if available
      if (master && Array.isArray(master) && master.length > 0) {
        const match = master.find(m =>
          m.BENZ === stock.BENZ &&
          m.BRAND === stock.BRAND
        );
        
        if (!match) {
          noMatchCount++;
          return transformedStock;
        }
        
        const finalDescription = (stock.DESCRIPTION !== null && stock.DESCRIPTION !== undefined && stock.DESCRIPTION !== '') 
          ? stock.DESCRIPTION 
          : (stock.REMARKS !== null && stock.REMARKS !== undefined && stock.REMARKS !== '')
          ? stock.REMARKS
          : (match.DESC ?? '');
        
        if (!finalDescription || finalDescription.trim() === '') {
          noDescriptionCount++;
        } else {
          withDescriptionCount++;
        }
        
        return {
          ...transformedStock,
          DINFLAG: (stock.DINFLAG !== null && stock.DINFLAG !== undefined && stock.DINFLAG !== '') ? stock.DINFLAG : (match.DINFLAG ?? ''),
          DESCRIPTION: finalDescription,
          APPLICATION: (stock.APPLICATION !== null && stock.APPLICATION !== undefined && stock.APPLICATION !== '') ? stock.APPLICATION : ((stock.APPL !== null && stock.APPL !== undefined && stock.APPL !== '') ? stock.APPL : (match.APPL ?? '')),
          UNIT: (stock.UNIT !== null && stock.UNIT !== undefined && stock.UNIT !== '') ? stock.UNIT : (match.UNIT ?? ''),
        };
      } else {
        // No master data available, return transformed stock as-is
        return transformedStock;
      }
    });
    
    // Log the statistics
    console.log('📊 DESCRIPTION STATISTICS:');
    console.log(`📦 Total items: ${result.length}`);
    console.log(`❌ No master match: ${noMatchCount}`);
    console.log(`📝 With description: ${withDescriptionCount}`);
    console.log(`🚫 No description: ${noDescriptionCount}`);
    console.log(`📈 Description success rate: ${((withDescriptionCount / result.length) * 100).toFixed(1)}%`);
    
    // Remove duplicates based on ID (keep the latest one)
    const uniqueResult = result.reduce((acc, item) => {
      const existingIndex = acc.findIndex(existing => existing.ID === item.ID);
      if (existingIndex >= 0) {
        // Replace with newer item (assuming higher ID is newer)
        if (item.ID > acc[existingIndex].ID) {
          acc[existingIndex] = item;
        }
      } else {
        acc.push(item);
      }
      return acc;
    }, []);
    
    // Check for duplicates in final result
    const duplicateCheck = uniqueResult.reduce((acc, item) => {
      const key = `${item.BENZ}-${item.BRAND}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    
    const duplicates = Object.entries(duplicateCheck).filter(([key, count]) => count > 1);
    if (duplicates.length > 0) {
      console.log('⚠️ DUPLICATES FOUND IN FINAL STOCKS:');
      duplicates.forEach(([key, count]) => {
        console.log(`  ${key}: ${count} times`);
      });
    } else {
      console.log('✅ No duplicates found in final stocks');
    }
    
    console.log(`📊 Final unique items: ${uniqueResult.length} (from ${result.length} original)`);
    
    return uniqueResult;
  }, [stocks, master]);

  // Sort and filter stocks (add dropdown logic)
  const sortedStocks = useMemo(() => {
    if (!mergedStocks || !Array.isArray(mergedStocks)) return [];
    let filteredStocks = [...mergedStocks];
    
    // Apply stock filter first
    switch (stockFilter) {
      case 'in-stock':
        // Include items with QTY > 0 OR items with service data (even if QTY = 0)
        filteredStocks = filteredStocks.filter(stock => {
          const hasQuantity = (parseInt(stock.QTY) || 0) > 0;
          const hasService = serviceData ? getServiceInfo(stock.ID, serviceData) : null;
          return hasQuantity || hasService;
        });
        break;
      case 'out-of-stock':
        filteredStocks = filteredStocks.filter(stock => (parseInt(stock.QTY) || 0) <= 0);
        break;
      case 'low-stock':
        filteredStocks = filteredStocks.filter(stock => {
          const qty = parseInt(stock.QTY) || 0;
          return qty > 0 && qty <= 5;
        });
        break;
      case 'all':
      default:
        // Show all items when "All Items" is selected
        break;
    }
    
    // Then apply sorting
    // If recent button was clicked, sort by highest ID first
    if (showRecentSort) {
      filteredStocks.sort((a, b) => b.ID - a.ID);
    } else {
      // Otherwise use the dropdown sorting
      switch (sortDropdown) {
        case 'quantity-high':
        filteredStocks.sort((a, b) => b.QUANTITY - a.QUANTITY);
        break;
      case 'quantity-low':
        filteredStocks.sort((a, b) => a.QUANTITY - b.QUANTITY);
        break;
      case 'price-low':
        filteredStocks.sort((a, b) => a.PRICE - b.PRICE);
        break;
      case 'price-high':
        filteredStocks.sort((a, b) => b.PRICE - a.PRICE);
        break;
      case 'date-old':
        filteredStocks.sort((a, b) => new Date(a.originalData.DATE) - new Date(b.originalData.DATE));
        break;
      case 'date-new':
        filteredStocks.sort((a, b) => new Date(b.originalData.DATE) - new Date(a.originalData.DATE));
        break;
      // 'featured' and 'best' do nothing for now
      default:
        break;
    }
    }
    
    // Debug: Check for duplicates in final sorted stocks
    console.log('📊 FINAL SORTED STOCKS DEBUG:');
    console.log(`  - Total filtered stocks: ${filteredStocks.length}`);
    console.log(`  - Sample IDs: ${filteredStocks.slice(0, 5).map(s => s.ID).join(', ')}`);
    
    return filteredStocks;
  }, [mergedStocks, sortDropdown, stockFilter, showRecentSort, serviceData]);

  // Computed selectAll (same as InventoryManagement.js)
  const selectAll = useMemo(() => {
    if (sortedStocks.length === 0) return false;
    return sortedStocks.every(stock => selectedStocks.some(s => s.ID === stock.ID));
  }, [sortedStocks, selectedStocks]);

  // Handlers
  const handlePageChange = (page) => {
    fetchStocks(page, searchTerm, stockFilter, sortDropdown);
    // Scroll to top of the page when changing pages
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };



  const handleSearchChange = (e) => {
    const newSearchTerm = e.target.value;
    
    // Remove any spaces from the input to keep numbers together
    const cleanSearchTerm = newSearchTerm.replace(/\s/g, '');
    
    setSearchTerm(cleanSearchTerm);
    
    // Check if this is a brand search
    const isBrand = checkIfBrandSearch(cleanSearchTerm, brands);
    setIsBrandSearch(isBrand);
    
    // Hide compatibility results when typing in search bar
    setShowCompatibilityResults(false);
  };

  // Enhanced search function that handles spaces and case sensitivity
  const handleSearchSubmit = () => {
    if (searchTerm.trim()) {
      // Clean the search term but keep it flexible
      const cleanSearchTerm = searchTerm.trim();
      setShowRecentSort(false); // Reset recent sort flag
      setShowingRecentItems(false); // Reset recent items view flag
      setShowCompatibilityResults(false); // Clear compatibility results when performing new search
      setCompatibilityResults([]); // Clear compatibility results array
      fetchStocks(1, cleanSearchTerm, stockFilter, sortDropdown);
    }
  };



  // Handle continue import after confirmation
  const handleContinueImport = async () => {
    try {
      setRefreshLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/stock/continue-import', {
        csvPath: clearConfirmationData.csvPath
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setShowClearConfirmation(false);
        setClearConfirmationData(null);
        setError('');
        setSuccessMessage(`Stock data refreshed successfully! Imported ${response.data.imported} records.`);
        // Add small delay to ensure backend operations are complete and reset fetching flag
        setTimeout(() => {
          setIsFetching(false); // Ensure flag is reset before calling fetchStocks
          fetchStocks(1, searchTerm, stockFilter, sortDropdown);
        }, 1000);
      }
    } catch (error) {
      console.error('Error continuing import:', error);
      setError(error.response?.data?.message || 'Failed to continue import');
    } finally {
      setRefreshLoading(false);
    }
  };

  // Handle revert to backup
  const handleRevertToBackup = async () => {
    try {
      setRefreshLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/stock/revert-to-backup', {
        backupTable: clearConfirmationData.backupTable
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setShowClearConfirmation(false);
        setClearConfirmationData(null);
        setError('');
        setSuccessMessage(`Successfully reverted to backup! Restored ${response.data.restored} records.`);
        // Add small delay to ensure backend operations are complete and reset fetching flag
        setTimeout(() => {
          setIsFetching(false); // Ensure flag is reset before calling fetchStocks
          fetchStocks(1, searchTerm, stockFilter, sortDropdown);
        }, 1000);
      }
    } catch (error) {
      console.error('Error reverting to backup:', error);
      setError(error.response?.data?.message || 'Failed to revert to backup');
    } finally {
      setRefreshLoading(false);
    }
  };





  const handleFilterChange = (e) => {
    const newFilter = e.target.value;
    setStockFilter(newFilter);
    setShowRecentSort(false); // Reset recent sort flag
    setShowingRecentItems(false); // Reset recent items view flag
    fetchStocks(1, searchTerm, newFilter, sortDropdown);
  };

  const handleSort = (col) => {
    let direction = 'asc';
    if (sortConfig.key === col && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key: col, direction });
  };

  const handleRefresh = () => {
    // Reset all state to initial values
    setSearchTerm('');
    setStockFilter('in-stock');
            setSortDropdown('recent');
    setCurrentPage(1);
    setError('');
    
    // Fetch fresh data with reset parameters
            fetchStocks(1, '', 'in-stock', 'recent');
  };

  const handleCardClick = (stock) => {
    // Use the merged stock object (with fallbacks) for editing
    setEditingStock(stock);
    setModalForm({ ...stock });
    setIsAddingNew(false);
    setShowModal(true);
  };

  const handleAddItem = () => {
    setEditingStock(null);
    setModalForm({});
    setIsAddingNew(true);
    setShowModal(true);
  };

  // Handle clicking on BENZ/PART NO to show movement history
  const handleBenzClick = async (e, benz, brand, altno, description, application) => {
    e.stopPropagation(); // Prevent row click
    
    if (!benz) {
      await showAlert('No part number available for this item.', 'No Part Number');
      return;
    }
    
    try {
      setMovementLoading(true);
      setMovementBenz(benz);
      setMovementBrand(brand || '');
      setMovementAltno(altno || '');
      
      // Try to get description and application from the passed parameters
      // If not provided, try to find in current stock data
      let itemDescription = description || '';
      let itemApplication = application || '';
      let stockQuantity = 0;
      
      // Sum all quantities from all stock items with this BENZ number (BENZ, BENZ2, or BENZ3)
      // First try sortedStocks
      const allMatchingStocks = sortedStocks.filter(s => 
        (s.BENZ === benz || s.BENZ2 === benz || s.BENZ3 === benz) &&
        (!brand || s.BRAND === brand) &&
        (!altno || s.ALTNO === altno)
      );
      
      stockQuantity = allMatchingStocks.reduce((sum, s) => {
        return sum + (parseInt(s.QTY || s.QUANTITY || 0));
      }, 0);
      
      // Get description and application from first matching stock
      if (allMatchingStocks.length > 0) {
        const firstStock = allMatchingStocks[0];
        itemDescription = itemDescription || firstStock.DESCRIPTION || firstStock.REMARKS || '';
        itemApplication = itemApplication || firstStock.APPLICATION || firstStock.APPL || '';
      }
      
      setMovementDescription(itemDescription);
      setMovementApplication(itemApplication);
      setMovementStockQuantity(stockQuantity);
      setShowMovementModal(true);
      
      const token = localStorage.getItem('token');
      // Don't filter by brand/altno when fetching - get ALL movement history for this BENZ
      // User can filter by brand in the frontend dropdown
      const response = await axios.get(`/api/stock/movement/${encodeURIComponent(benz)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setMovementData(response.data.data || []);
        // Reset filters when new data is loaded
        setFilterYear('');
        setFilterMonths('');
        setFilterBrand('');
      } else {
        throw new Error(response.data.message || 'Failed to fetch movement history');
      }
    } catch (error) {
      console.error('Error fetching movement history:', error);
      await showAlert(
        error.response?.data?.message || error.message || 'Failed to fetch item movement history.', 
        'Error'
      );
      setShowMovementModal(false);
    } finally {
      setMovementLoading(false);
    }
  };

  // Filter movement data based on year and months
  const filteredMovementData = useMemo(() => {
    if (!movementData || movementData.length === 0) return [];
    
    let filtered = [...movementData];
    
    // Filter by year
    if (filterYear) {
      filtered = filtered.filter(record => {
        if (!record.DATE) return false;
        const recordYear = new Date(record.DATE).getFullYear();
        return recordYear.toString() === filterYear;
      });
    }
    
    // Filter by months
    if (filterMonths) {
      const months = parseInt(filterMonths);
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - months);
      cutoffDate.setHours(0, 0, 0, 0);
      
      filtered = filtered.filter(record => {
        if (!record.DATE) return false;
        const recordDate = new Date(record.DATE);
        recordDate.setHours(0, 0, 0, 0);
        return recordDate >= cutoffDate;
      });
    }
    
    // Filter by brand
    if (filterBrand) {
      filtered = filtered.filter(record => {
        const recordBrand = record.BRAND || '';
        return recordBrand.toLowerCase() === filterBrand.toLowerCase();
      });
    }
    
    return filtered;
  }, [movementData, filterYear, filterMonths, filterBrand]);

  // Get available years from movement data
  const availableYears = useMemo(() => {
    if (!movementData || movementData.length === 0) return [];
    const years = new Set();
    movementData.forEach(record => {
      if (record.DATE) {
        const year = new Date(record.DATE).getFullYear();
        years.add(year.toString());
      }
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [movementData]);

  // Get available brands from movement data
  const availableBrands = useMemo(() => {
    if (!movementData || movementData.length === 0) return [];
    const brands = new Set();
    movementData.forEach(record => {
      if (record.BRAND) {
        brands.add(record.BRAND);
      }
    });
    return Array.from(brands).sort();
  }, [movementData]);

  const overallQuantity = movementStockQuantity;

  const handleModalClose = () => {
    setShowModal(false);
    setEditingStock(null);
    setModalForm({});
    setIsAddingNew(false);
  };

  const handleModalFormChange = (e) => {
    setModalForm({ ...modalForm, [e.target.name]: e.target.value });
  };

  const handleModalSave = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found. Please log in again.');
        return;
      }

      // Prepare the data for API
      const stockData = {
        BRAND: modalForm.BRAND || '',
        BENZ: modalForm.BENZ || '',
        BENZ2: modalForm.BENZ2 || '',
        BENZ3: modalForm.BENZ3 || '',
        ALTNO: modalForm.ALTNO || '',
        ALTNO2: modalForm.ALTNO2 || '',
        DESCRIPTION: modalForm.DESCRIPTION || '',
        APPLICATION: modalForm.APPLICATION || '',
        COLORCODE: modalForm.COLORCODE || '',
        REMARKS: modalForm.REMARKS || '',
        COST: parseFloat(modalForm.COST) || 0,
        SELL: parseFloat(modalForm.SELL) || 0,
        QTY: parseInt(modalForm.QTY) || 0,
        UNIT: modalForm.UNIT || '',
        LOCATION: modalForm.LOCATION || '',
        OEM: modalForm.OEM || '',
        DINFLAG: modalForm.DINFLAG || '',
        CURRENCY: modalForm.CURRENCY || '',
        FC_COST: parseFloat(modalForm.FC_COST) || 0,
        FCAMOUNT: parseFloat(modalForm.FCAMOUNT) || 0,
        CONVERSION: parseFloat(modalForm.CONVERSION) || 0,
        DATE: modalForm.DATE || new Date().toISOString().split('T')[0],
        REFERENCE: modalForm.REFERENCE || ''
      };

      if (isAddingNew) {
        // Add new stock item
        await axios.post('/api/stock-items', stockData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setError('');
        // Show success message or handle as needed
      } else {
        // Update existing stock item
        await axios.put(`/api/stock-items/${editingStock.ID}`, stockData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setError('');
        // Show success message or handle as needed
      }
      
      // Close modal and refresh data
      handleModalClose();
      fetchStocks(currentPage, searchTerm, stockFilter, sortDropdown);
      
    } catch (error) {
      console.error('Error saving stock item:', error);
      if (error.response?.status === 401) {
        setError('Authentication failed. Please log in again.');
      } else if (error.response?.status === 400) {
        setError(`Validation error: ${error.response.data?.message || 'Please check your input.'}`);
      } else if (error.response?.status === 500) {
        setError(`Server error: ${error.response.data?.error || error.message}`);
      } else {
        setError(`Failed to save stock item: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return parseFloat(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  // Add click animation to filter and sort
  const handleFilterClick = (e) => {
    const container = e.target.closest('.pos-filter-container');
    if (container) {
      container.classList.add('clicked');
      setTimeout(() => container.classList.remove('clicked'), 250);
    }
  };

  // Disable body scroll when modal is open
  useEffect(() => {
    if (showModal || scanModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup function to re-enable scroll when component unmounts
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showModal, scanModalOpen]);


  // Auto-clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleRequestClick = (stock) => {
    setRequestingStock(stock);
    setShowRequestModal(true);
    setRequestReason('');
  };

  const handleRequestModalClose = () => {
    setShowRequestModal(false);
    setRequestingStock(null);
    setRequestReason('');
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      // Fallback logic for partNo, oem, brand
      const partNo = requestingStock?.BENZ || requestingStock?.CODE || requestingStock?.ID || '';
      const oem = requestingStock?.ALTNO || requestingStock?.OEM || requestingStock?.CODE || '';
      const brand = requestingStock?.BRAND || requestingStock?.NAME || '';
      await axios.post('/api/stock-requests', {
        stockId: requestingStock?.ID,
        stockDescription: requestingStock?.DESCRIPTION,
        reason: requestReason,
        userId: user?.id,
        username: user?.username,
        partNo,
        oem,
        brand
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowRequestModal(false);
      setRequestingStock(null);
      setRequestReason('');
      await showAlert('Request submitted!', 'Success');
    } catch (err) {
      await showAlert('Failed to submit request.', 'Error');
    }
  };



  // Add a date formatting helper
  function formatDateLabel(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  // Format date as M/D/YYYY (e.g., "9/11/2025")
  function formatDateShort(dateStr) {
    if (!dateStr) return '';
    // Handle different date formats
    let date;
    if (typeof dateStr === 'string') {
      // Handle YYYY-MM-DD format
      if (dateStr.includes('-')) {
        date = new Date(dateStr);
      } else if (dateStr.length === 8) {
        // Handle YYYYMMDD format
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        date = new Date(`${year}-${month}-${day}`);
      } else {
        date = new Date(dateStr);
      }
    } else {
      date = new Date(dateStr);
    }
    
    if (isNaN(date.getTime())) return dateStr;
    
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  }

  // Accounting/Indian format for price
  function formatAccountingINR(amount) {
    const numValue = Number(amount);
    if (isNaN(numValue)) return '0.00';
    // Use toFixed to ensure 2 decimal places, then format with locale for thousands separators
    return numValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // Helper to split BENZ into groups
  function splitBenzGroups(benz) {
    if (!benz) return [];
    return benz.split(/\s+/);
  }

  // Handle individual row selection (sets quantity to 1 for cart)
  const handleSelectRow = async (id) => {
    console.log('[HANDLE SELECT ROW]', id);
    const stock = sortedStocks.find(s => s.ID === id);
    if (!stock || !stock.ID) {
      await showAlert('This item does not have a valid ID and cannot be selected.', 'Invalid Item');
      return;
    }
    if (selectedStocks.some(s => s.ID === id)) {
      // Remove from selection
      setSelectedStocks(prev => prev.filter(s => s.ID !== id));
    } else {
      // Add to selection with quantity 1
      // Ensure price is set from SELL or PRICE field
      const price = parseFloat(stock.SELL) || parseFloat(stock.PRICE) || 0;
      const stockWithQty = { 
        ...stock, 
        QUANTITY: 1,
        PRICE: price,
        SELL: stock.SELL || stock.PRICE || 0
      };
      setSelectedStocks(prev => [...prev, stockWithQty]);
      setLastAddedToCartId(stock.ID);
      console.log('✅ Item added to cart:', stock.ID, stock.BENZ);
      setTimeout(() => {
        setLastAddedToCartId(null);
        console.log('🔄 Animation cleared for:', stock.ID);
      }, 800);
    }
  };

  // Handle compatibility row selection (sets quantity to 1 for cart)
  const handleCompatibilitySelectRow = async (part) => {
    console.log('[HANDLE COMPATIBILITY SELECT ROW]', part);
    if (!part || !part.ID) {
      await showAlert('This item does not have a valid ID and cannot be selected.', 'Invalid Item');
      return;
    }
    if (selectedStocks.some(s => s.ID === part.ID)) {
      // Remove from selection
      setSelectedStocks(prev => prev.filter(s => s.ID !== part.ID));
    } else {
      // Add to selection with quantity 1
      // Ensure price is set from SELL or PRICE field
      const price = parseFloat(part.SELL) || parseFloat(part.PRICE) || 0;
      const partWithQty = { 
        ...part, 
        QUANTITY: 1,
        PRICE: price,
        SELL: part.SELL || part.PRICE || 0
      };
      setSelectedStocks(prev => [...prev, partWithQty]);
      setLastAddedToCartId(part.ID);
      console.log('✅ Compatible item added to cart:', part.ID, part.BENZ);
      setTimeout(() => {
        setLastAddedToCartId(null);
        console.log('🔄 Animation cleared for:', part.ID);
      }, 800);
    }
  };

  // Handle select all (sets quantity to 1 for cart)
  const handleSelectAll = () => {
    if (selectAll) {
      // Remove all items from current page from selection
      setSelectedStocks(selectedStocks.filter(s => !sortedStocks.some(st => st.ID === s.ID)));
    } else {
      // Add all items from current page to selection with quantity 1
      const newStocks = sortedStocks
        .filter(st => !selectedStocks.some(s => s.ID === st.ID) && st.ID)
        .map(st => {
          const price = parseFloat(st.SELL) || parseFloat(st.PRICE) || 0;
          return { 
            ...st, 
            QUANTITY: 1,
            PRICE: price,
            SELL: st.SELL || st.PRICE || 0
          };
        });
      setSelectedStocks([...selectedStocks, ...newStocks]);
    }
  };

  // Handle row click for main stock table
  const handleRowClick = (e, stockId) => {
    // Prevent row click if clicking on checkbox, input, or button
    if (e.target.type === 'checkbox' || 
        e.target.tagName === 'INPUT' || 
        e.target.tagName === 'BUTTON' ||
        e.target.closest('button') ||
        e.target.closest('input')) {
      return;
    }
    handleSelectRow(stockId);
  };

  // Handle row click for compatibility results
  const handleCompatibilityRowClick = (e, part) => {
    // Prevent row click if clicking on checkbox, input, or button
    if (e.target.type === 'checkbox' || 
        e.target.tagName === 'INPUT' || 
        e.target.tagName === 'BUTTON' ||
        e.target.closest('button') ||
        e.target.closest('input')) {
      return;
    }
    handleCompatibilitySelectRow(part);
  };





  // Handle barcode scan with detailed modal
  const handleBarcodeScan = async (barcode) => {
    // Handle case where no barcode is provided (just open scanner)
    if (!barcode) {
      setBarcodeScannerOpen(true);
      setScannedBarcode('');
      return;
    }
    
    // Ensure barcode is a string and not empty
    const barcodeStr = String(barcode).trim();
    if (barcodeStr === '') return;
    
    try {
      setBarcodeScannerOpen(false);
      setScannedBarcode(barcodeStr);
      
      // Fast search by ID in tbl_stock
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/stock/barcode-scan/${barcodeStr}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.found) {
        setScannedStockData(response.data.stock);
        setScannedMasterData(response.data.master);
        setScannedInmainData(response.data.inmain);
        setScannedQualityData(response.data.quality);
        setShowBarcodeResult(true);
      } else {
        setScannedStockData(null);
        setScannedMasterData(null);
        setScannedInmainData(null);
        setScannedQualityData(null);
        setShowBarcodeResult(true);
      }
      
    } catch (error) {
      console.error('Barcode scan error:', error);
      setScannedStockData(null);
      setScannedMasterData(null);
      setScannedInmainData(null);
      setScannedQualityData(null);
      setShowBarcodeResult(true);
    }
  };

  // State for export preview modal
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [exportPreviewData, setExportPreviewData] = useState([]);
  const [exportType, setExportType] = useState('');
  


  // State for CSV import modal
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importType, setImportType] = useState('stock'); // 'stock' or 'master'

  // State for barcode scan result modal
  const [showBarcodeResult, setShowBarcodeResult] = useState(false);
  const [scannedStockData, setScannedStockData] = useState(null);
  const [scannedMasterData, setScannedMasterData] = useState(null);
  const [scannedInmainData, setScannedInmainData] = useState(null);
  const [scannedQualityData, setScannedQualityData] = useState(null);

  // Compatibility search state
  const [compatibilityResults, setCompatibilityResults] = useState([]);
  const [compatibilityLoading, setCompatibilityLoading] = useState(false);
  const [showCompatibilityResults, setShowCompatibilityResults] = useState(false);
  const [brands, setBrands] = useState([]);
  const [isBrandSearch, setIsBrandSearch] = useState(false);

  // DBF refresh loading state (for Clear Confirmation Modal)
  const [refreshLoading, setRefreshLoading] = useState(false);

  // Clear all items from export preview
  const clearAllExportItems = async () => {
    if (exportPreviewData.length === 0) return;
    
    const confirmed = await showConfirm(
      `Are you sure you want to clear all ${exportPreviewData.length} items from the export preview?`,
      'Clear Export Preview'
    );
    
    if (confirmed) {
      setExportPreviewData([]);
      setShowExportPreview(false);
      // Also uncheck all selected items in the main table
      setSelectedStocks([]);
    }
  };

  // Remove individual item from export preview
  const removeExportItem = async (index) => {
    const item = exportPreviewData[index];
    const confirmed = await showConfirm(
      `Are you sure you want to remove "${item['DESCRIPTION'] || item['BENZ'] || item['ID']}" from the export preview?`,
      'Remove Item'
    );
    
    if (confirmed) {
      setExportPreviewData(prevData => prevData.filter((_, i) => i !== index));
    }
  };

  // Handle CSV file selection
  const handleCSVFileSelect = async (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
    } else {
      await showAlert('Please select a valid CSV file.', 'Invalid File');
    }
  };

  // Handle CSV import with streaming progress
  const handleCSVImport = async () => {
    if (!csvFile) {
      await showAlert('Please select a CSV file first.', 'No File Selected');
      return;
    }

    const confirmed = await showConfirm(
      `⚠️ WARNING: This will replace ALL existing ${importType === 'stock' ? 'stock' : 'master'} data with the CSV data!\n\nThis action will:\n1. Create a backup of current data\n2. Delete all existing ${importType === 'stock' ? 'stock' : 'master'} records\n3. Import new data from the CSV file\n\nAre you sure you want to continue?`,
      'Confirm Import'
    );
    
    if (!confirmed) {
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setImportStatus('Starting import process...');

    try {
      const formData = new FormData();
      formData.append('csvFile', csvFile);

      setImportStatus('Uploading CSV file...');
      setImportProgress(10);

      const token = localStorage.getItem('token');
      
      // Use fetch for streaming response
      const endpoint = importType === 'stock' ? '/api/stock/upload-csv' : '/api/master/import-csv';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.trim()) {
            console.log('Progress:', line);
            
            // Update status based on progress messages
            if (line.includes('📁 Processing uploaded CSV file')) {
              setImportStatus('Processing uploaded CSV file...');
              setImportProgress(15);
            } else if (line.includes('📋 CSV Headers:')) {
              setImportStatus('CSV Headers parsed...');
              setImportProgress(20);
            } else if (line.includes('📊 Parsing CSV data')) {
              setImportStatus('Parsing CSV data...');
              setImportProgress(25);
            } else if (line.includes('📊 Parsed') && line.includes('data rows from CSV')) {
              setImportStatus('CSV parsing completed');
              setImportProgress(30);
            } else if (line.includes('🚀 Starting CSV import process')) {
              setImportStatus('Starting CSV import process...');
              setImportProgress(35);
            } else if (line.includes('📦 Creating backup table:')) {
              setImportStatus('Creating backup table...');
              setImportProgress(40);
            } else if (line.includes('✅ Backup created with')) {
              setImportStatus('Backup created successfully');
              setImportProgress(45);
            } else if (line.includes('🗑️ Clearing existing data')) {
              setImportStatus('Clearing existing data...');
              setImportProgress(50);
            } else if (line.includes('📝 Creating temporary CSV file')) {
              setImportStatus('Creating temporary file...');
              setImportProgress(55);
            } else if (line.includes('📁 Temporary file created:')) {
              setImportStatus('Temporary file ready');
              setImportProgress(60);
            } else if (line.includes('🚀 Starting fast import with optimized batch inserts')) {
              setImportStatus('Starting fast database import...');
              setImportProgress(70);
            } else if (line.includes('📊 Progress:')) {
              // Extract progress percentage and count from the line
              const progressMatch = line.match(/Progress: (\d+)% \((\d+)\/(\d+)\)/);
              if (progressMatch) {
                const progressPercent = parseInt(progressMatch[1]);
                const currentCount = parseInt(progressMatch[2]);
                const totalCount = parseInt(progressMatch[3]);
                setImportProgress(70 + (progressPercent * 0.25)); // Progress from 70% to 95%
                setImportStatus(`Importing data: ${currentCount.toLocaleString()}/${totalCount.toLocaleString()} records`);
              }
            } else if (line.includes('🧹 Temporary file cleaned up')) {
              setImportStatus('Cleaning up temporary files...');
              setImportProgress(95);
            } else if (line.includes('🎉 CSV import completed successfully')) {
              setImportStatus('Import completed successfully!');
              setImportProgress(100);
              
              // Parse the result from the stream
              const importResult = {
                success: true,
                message: 'CSV import completed successfully',
                importedCount: csvFile.size > 0 ? Math.floor(csvFile.size / 100) : 0, // Estimate
                backupTable: (importType === 'stock' ? 'tbl_stock_backup_' : 'master_backup_') + new Date().toISOString().replace(/[:.-]/g, '_').slice(0, 19)
              };
              
              setImportResult(importResult);
              
              // Refresh the appropriate data based on import type
              setTimeout(() => {
                if (importType === 'stock') {
                  fetchStocks(1, searchTerm, stockFilter, sortDropdown);
                } else {
                  // Refresh master data if needed
                  // For now, just refresh stocks as they might reference master data
                  fetchStocks(1, searchTerm, stockFilter, sortDropdown);
                }
              }, 2000);
            } else if (line.includes('❌')) {
              setImportStatus(`Import failed: ${line}`);
              setImportResult({ success: false, error: line });
            }
          }
        }
      }

    } catch (error) {
      console.error('CSV import error:', error);
      setImportStatus(`Import failed: ${error.message}`);
      setImportResult({ success: false, error: error.message });
    } finally {
      setIsImporting(false);
    }
  };

  // Reset CSV import modal
  const resetCSVImport = () => {
    setCsvFile(null);
    setImportProgress(0);
    setImportStatus('');
    setImportResult(null);
    setImportType('stock'); // Reset to stock import type
    setShowCSVImport(false);
  };

  // Show export preview
  const handleExportPreview = async () => {
    // Only allow export when items are specifically selected
    if (selectedStocks.length === 0) {
        showNotification('warning', 'No Items Selected', 'Please select items first by checking the checkboxes next to the stock items you want to export.');
      return;
    }
    
    // Export only selected items
    const stocksToExport = sortedStocks.filter(stock => 
      selectedStocks.some(s => s.ID === stock.ID)
    );
    const exportTypeValue = 'selected';
    
    if (stocksToExport.length === 0) {
      await showAlert('No selected items found. Please select items first.', 'No Items Selected');
      return;
    }
    
    // Create preview data with BENZ, BENZ2, BENZ3, and other columns
    const previewData = stocksToExport.map(stock => ({
      'BENZ': stock.BENZ || '',
      'BENZ2': stock.BENZ2 || '',
      'BENZ3': stock.BENZ3 || '',
      'BRAND': stock.BRAND || '',
      'ALT NO': stock.ALTNO || '',
      'DESCRIPTION': stock.DESCRIPTION || stock.REMARKS || '',
      'ID': stock.ID || '',
      'ID BARCODE': stock.ID || '' // Same as ID as shown in the image
    }));
    
    setExportPreviewData(previewData);
    setExportType(exportTypeValue);
    setShowExportPreview(true);
  };

  // Export selected items to Excel
  const handleExportToExcel = () => {
    try {
      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      
      // Convert data to worksheet format
      const worksheet = XLSX.utils.json_to_sheet(exportPreviewData);
      
      // Set column widths
      const columnWidths = [
        { wch: 15 }, // BENZ
        { wch: 15 }, // BENZ2
        { wch: 15 }, // BENZ3
        { wch: 20 }, // BRAND
        { wch: 15 }, // ALT NO
        { wch: 40 }, // DESCRIPTION
        { wch: 10 }, // ID
        { wch: 15 }  // ID BARCODE
      ];
      worksheet['!cols'] = columnWidths;
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Items');
      
      // Generate XLSX file
      const exportTypeText = exportType === 'selected' ? 'selected' : 'filtered';
      const fileName = `stock_export_${exportTypeText}_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Write and download file
      XLSX.writeFile(workbook, fileName);
      
      // Show success message and close modal
      const message = exportType === 'selected' 
        ? `Successfully exported ${exportPreviewData.length} selected items to XLSX!`
        : `Successfully exported ${exportPreviewData.length} filtered items to XLSX!`;
      showNotification('success', 'Export Successful', message);
      setShowExportPreview(false);
      
    } catch (error) {
      console.error('Export error:', error);
      showNotification('error', 'Export Failed', 'Error exporting to Excel. Please try again.');
    }
  };



  // Handler for adding items to existing warehouse order
  const handleAddToOrder = async () => {
    if (!addToOrderId) {
      await showAlert('Order ID is missing. Please try again.', 'Error');
      return;
    }

    if (selectedStocks.length === 0) {
      await showAlert('Please select items to add to the order.', 'No Items Selected');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const cartItems = selectedStocks.map(s => {
        // Handle both regular stock items and compatible parts
        // Regular items might have originalData.id, compatible parts have ID directly
        const stockId = s.originalData?.id || s.ID || s.id;
        const price = parseFloat(s.PRICE) || parseFloat(s.SELL) || 0;
        
        return {
          stock_id: parseInt(stockId),
          quantity: parseInt(s.QUANTITY) || 1,
          description: s.DESCRIPTION || s.DESC || '',
          custom_price: price
        };
      });
      
      // Validate cart items
      const invalidItems = cartItems.filter(item => 
        !item.stock_id || isNaN(item.stock_id) || 
        !item.quantity || isNaN(item.quantity) || item.quantity <= 0
      );
      
      if (invalidItems.length > 0) {
        await showAlert('Some items have invalid data and cannot be added to order.', 'Invalid Data');
        return;
      }
      
      console.log('[FRONTEND] Adding to order:', { orderId: addToOrderId, cartItems });
      
      const res = await axios.post('/api/warehouse/add-to-order', 
        { order_id: addToOrderId, cartItems }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (res.data && res.data.success) {
        setCartOpen(false);
        setSelectedStocks([]);
        // Navigate back to warehouses page with success parameter
        navigate(`/warehouses?addedToOrder=true&orderId=${addToOrderId}`);
        // Refresh stock data to show updated quantities
        fetchStocks(currentPage, searchTerm, stockFilter, sortDropdown);
      } else {
        await showAlert(res.data?.message || 'Failed to add items to order.', 'Error');
      }
    } catch (err) {
      console.error('Add to order error:', err);
      if (err.response && err.response.data) {
        const { message, insufficient } = err.response.data;
        if (insufficient && Array.isArray(insufficient) && insufficient.length > 0) {
          const details = insufficient.map(i => 
            `ID: ${i.stock_id}, Requested: ${i.requested}, Available: ${i.available}`
          ).join('\n');
          await showAlert(`${message || 'Some items have insufficient stock.'}\n\n${details}`, 'Insufficient Stock');
        } else {
          await showAlert(message || 'Failed to add items to order.', 'Error');
        }
      } else {
        await showAlert('Failed to add items to order.', 'Error');
      }
    }
  };

    // Handler for sending to warehouse - opens modal first
  const handleSendToWarehouse = () => {
    if (selectedStocks.length === 0) {
      showNotification('warning', 'Cart Empty', 'Please add items to cart before sending to warehouse.');
      return;
    }
    setWarehouseModalOpen(true);
    setWarehouseCustomerName(''); // Reset customer name
  };

  // Confirm and send to warehouse with customer name
  const handleConfirmSendToWarehouse = async () => {
    // Validate customer name
    if (!warehouseCustomerName || !warehouseCustomerName.trim()) {
      await showAlert('Customer name is required to send order to warehouse.', 'Customer Name Required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const cartItems = selectedStocks.map(s => {
        // Handle both regular stock items and compatible parts
        // Regular items might have originalData.id, compatible parts have ID directly
        const stockId = s.originalData?.id || s.ID || s.id;
        const price = parseFloat(s.PRICE) || parseFloat(s.SELL) || 0;
        
        return {
          stock_id: parseInt(stockId),
          quantity: parseInt(s.QUANTITY) || 1,
          description: s.DESCRIPTION || s.DESC || '',
          custom_price: price
        };
      });
      
      // Validate cart items
      const invalidItems = cartItems.filter(item => 
        !item.stock_id || isNaN(item.stock_id) || 
        !item.quantity || isNaN(item.quantity) || item.quantity <= 0
      );
      
      if (invalidItems.length > 0) {
        console.error('[FRONTEND] Invalid cart items:', invalidItems);
        await showAlert('Some items have invalid data and cannot be sent to warehouse.', 'Invalid Data');
        return;
      }
      
      console.log('[FRONTEND] Sending to warehouse:', cartItems);
      console.log('[FRONTEND] Selected stocks:', selectedStocks);
      
      // Check for duplicate stock_ids in cart
      const stockIds = cartItems.map(item => item.stock_id);
      const uniqueStockIds = [...new Set(stockIds)];
      if (stockIds.length !== uniqueStockIds.length) {
        console.error('[FRONTEND] WARNING: Duplicate stock_ids found in cart:', stockIds);
        console.error('[FRONTEND] Unique stock_ids:', uniqueStockIds);
        await showAlert('Warning: Duplicate items detected in cart. Please check your selection.', 'Duplicate Items');
        return;
      }
              const res = await axios.post('/api/warehouse/submit', { 
          cartItems, 
          customer_name: warehouseCustomerName.trim().toUpperCase() 
        }, { headers: { Authorization: `Bearer ${token}` } });
        if (res.data && res.data.success) {
          showNotification('success', 'Order Sent to Warehouse', `Order sent to warehouse!\nOrder Number: #${res.data.order_id}`);
          setWarehouseModalOpen(false);
          setWarehouseCustomerName('');
          setCartOpen(false);
          setSelectedStocks([]);
          setOrderId(null);
          setOrderNumber(null);
        // Refresh stock data to show updated quantities
        fetchStocks(currentPage, searchTerm, stockFilter, sortDropdown);
        
        // Update compatibility results to reflect quantity changes
        if (compatibilityResults.length > 0) {
          const updatedCompatibilityResults = compatibilityResults.map(part => {
            const sentItem = cartItems.find(item => item.stock_id === part.ID);
            if (sentItem) {
              return {
                ...part,
                QTY: Math.max(0, part.QTY - sentItem.quantity)
              };
            }
            return part;
          });
          setCompatibilityResults(updatedCompatibilityResults);
          console.log('[FRONTEND] Updated compatibility results after warehouse submission');
        }
      } else {
        let errorMessage = res.data && res.data.message ? res.data.message : 'Failed to send order to warehouse.';
        
        // If there are insufficient stock items, show details
        if (res.data && res.data.insufficient && res.data.insufficient.length > 0) {
          const insufficientDetails = res.data.insufficient.map(item => 
            `ID ${item.stock_id}: requested ${item.requested}, available ${item.available}`
          ).join('\n');
          errorMessage += '\n\nInsufficient stock:\n' + insufficientDetails;
        }
        
        await showAlert(errorMessage, 'Error');
      }
    } catch (err) {
      if (err.response && err.response.data) {
        const { message, insufficient } = err.response.data;
        if (err.response.status === 400 && message && message.toLowerCase().includes('no items in cart')) {
          await showAlert('Your cart is empty. Please add items before submitting to warehouse.', 'Empty Cart');
        } else if (insufficient && Array.isArray(insufficient) && insufficient.length > 0) {
          let details = '';
          if (insufficient.length === selectedStocks.length) {
            details = 'All items in your cart are no longer available or have insufficient stock.';
          } else {
            details = 'Some items are no longer available or have insufficient stock.';
            const preview = insufficient.slice(0, 3).map(i => `ID: ${i.stock_id}, Requested: ${i.requested}, Available: ${i.available}`).join('\n');
            details += '\n' + preview;
            if (insufficient.length > 3) {
              details += `\n+${insufficient.length - 3} more...`;
            }
          }
          await showAlert(`${message || 'Some items are no longer available.'}\n\n${details}`, 'Insufficient Stock');
        } else {
          await showAlert(message || 'Failed to send order to warehouse.', 'Error');
        }
      } else {
        await showAlert('Failed to send order to warehouse.', 'Error');
      }
    }
  };

  const handleGenerateQuotation = () => {
    if (selectedStocks.length === 0) {
        showNotification('warning', 'Cart Empty', 'Please add items to cart before generating quotation.');
      return;
    }
    setQuotationModalOpen(true);
  };

  const handleQuotationSubmit = async () => {
    if (!quotationForm.customer_name.trim()) {
      await showAlert('Customer name is required.', 'Required Field');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const cartItems = selectedStocks.map(s => ({ 
        stock_id: s.originalData.id, 
        quantity: s.QUANTITY 
      }));

      const quotationData = {
        customer_name: quotationForm.customer_name.trim().toUpperCase(),
        chassis_number: quotationForm.chassis_number.trim(),
        contact_number: quotationForm.contact_number.trim(),
        cartItems
      };

      const res = await axios.post('/api/quotations', quotationData, { 
        headers: { Authorization: `Bearer ${token}` } 
      });

      if (res.data && res.data.success) {
        showNotification('success', 'Quotation Generated', `Quotation generated successfully!\nQuotation Number: ${res.data.quotation_number}\nTotal Amount: ₱${res.data.total_amount.toLocaleString()}`);
        
        // Close modals and reset
        setQuotationModalOpen(false);
        setCartOpen(false);
        setSelectedStocks([]);
        setOrderId(null);
        setOrderNumber(null);
        setQuotationForm({
          customer_name: '',
          chassis_number: '',
          contact_number: ''
        });
      } else {
        showNotification('error', 'Generation Failed', 'Failed to generate quotation. Please try again.');
      }
    } catch (error) {
      console.error('Error generating quotation:', error);
      showNotification('error', 'Quotation Error', 'Error generating quotation: ' + (error.response?.data?.message || error.message));
    }
  };

  // Compatibility search function
  const handleCompatibilitySearch = async () => {
    const cleanSearchTerm = searchTerm.replace(/\s/g, '');
    
    if (!cleanSearchTerm.trim()) {
      await showAlert('Please enter a search term for compatibility search.', 'Empty Search');
      return;
    }

    try {
      setCompatibilityLoading(true);
      const token = localStorage.getItem('token');
      
      // First, get the current search results to find the BENZ number to use for compatibility
      const currentSearchResponse = await axios.get(`/api/stock-items?search=${encodeURIComponent(searchTerm.trim())}&page=1&limit=1000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Check if any items were found
      if (!currentSearchResponse.data?.data || currentSearchResponse.data.data.length === 0) {
        await showAlert('No items found for compatibility search.', 'No Results');
        setCompatibilityLoading(false);
        return;
      }
      
      // Get the first matching item
      const firstItem = currentSearchResponse.data.data[0];
      let compatibilitySearchTerm = '';
      
      // Use BENZ number if available, otherwise use brand + altno combination
      if (firstItem.BENZ && firstItem.BENZ.trim()) {
        compatibilitySearchTerm = firstItem.BENZ;
        console.log(`🔗 Using BENZ number for compatibility search: ${compatibilitySearchTerm}`);
      } else if (firstItem.BRAND && firstItem.ALTNO) {
        compatibilitySearchTerm = `${firstItem.BRAND} ${firstItem.ALTNO}`;
        console.log(`🔗 Using brand+altno combination for compatibility search: ${compatibilitySearchTerm}`);
      } else {
        await showAlert('No valid BENZ number or brand+altno combination found for compatibility search.', 'No Valid Data');
        setCompatibilityLoading(false);
        return;
      }
      
      console.log('🔗 Current search response:', currentSearchResponse.data);
      console.log('🔗 Current search data sample:', currentSearchResponse.data?.data?.slice(0, 3));
      console.log('🔗 First item fields:', currentSearchResponse.data?.data?.[0] ? Object.keys(currentSearchResponse.data.data[0]) : 'No data');
      
      // Try different possible ID field names
      let idField = 'ID';
      if (firstItem) {
        if (firstItem.id !== undefined) idField = 'id';
        else if (firstItem.ID !== undefined) idField = 'ID';
        else if (firstItem.stock_id !== undefined) idField = 'stock_id';
        else if (firstItem.STOCK_ID !== undefined) idField = 'STOCK_ID';
      }
      console.log('🔗 Using ID field:', idField);
      
      const currentSearchIds = currentSearchResponse.data?.data?.map(stock => stock[idField]).filter(id => id !== undefined) || [];
      console.log('🔗 Current search IDs to exclude:', currentSearchIds);
      
      // Then get compatibility results using the determined search term
      const response = await axios.get(`/api/stock-items/compatibility?search=${encodeURIComponent(compatibilitySearchTerm)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data && response.data.success) {
        console.log('🔗 Compatibility search response:', response.data);
        console.log('🔗 Results array:', response.data.results);
        console.log('🔗 Results length:', response.data.results?.length);
        
        // Filter out parts that have the same ID as the current search results
        console.log('🔗 Before filtering - compatibility results:', response.data.results?.map(r => ({ ID: r.ID, BENZ: r.BENZ })));
        console.log('🔗 IDs to exclude:', currentSearchIds);
        
        const filteredResults = (response.data.results || []).filter(part => {
          const shouldExclude = currentSearchIds.includes(part.ID);
          console.log(`🔗 Part ID ${part.ID} (${part.BENZ}) - should exclude: ${shouldExclude}`);
          return !shouldExclude;
        });
        
        console.log('🔗 After filtering - filtered results:', filteredResults.map(r => ({ ID: r.ID, BENZ: r.BENZ })));
        console.log('🔗 Filtered results length:', filteredResults.length);
        
        setCompatibilityResults(filteredResults);
        setShowCompatibilityResults(true);
        console.log(`🔗 Found ${filteredResults.length} compatible parts (excluding originals) across ${response.data.levels} levels`);
      } else {
        console.log('🔗 No compatible parts found or success=false');
        await showAlert('No compatible parts found.', 'No Results');
      }
    } catch (error) {
      console.error('Error searching for compatible parts:', error);
      await showAlert('Error searching for compatible parts: ' + (error.response?.data?.message || error.message), 'Error');
    } finally {
      setCompatibilityLoading(false);
    }
  };


  // Helper functions for price editing
  const getRawPrice = (price) => {
    return price ? price.toString() : '';
  };

  const getFormattedPrice = (price) => {
    return formatAccountingINR(price);
  };

  // Add a handler to update price in the cart
  // Format input as Indian accounting and update value
  const handleCartPriceChange = (id, value) => {
    // Remove commas and parse float
    const numericValue = parseFloat((value || '').toString().replace(/,/g, '')) || 0;
    setSelectedStocks(prev => prev.map(s => s.ID === id ? { ...s, PRICE: numericValue } : s));
  };

  // Handle price focus - show raw value for editing
  const handlePriceFocus = (id) => {
    setEditingPriceId(id);
    // Clear the price to empty when clicked for easy typing
    setSelectedStocks(prev => prev.map(s => 
      s.ID === id ? { ...s, _rawPrice: '' } : s
    ));
  };

  // Handle price blur - format and save
  const handlePriceBlur = (id, value) => {
    const numericValue = parseFloat(value.replace(/,/g, '')) || 0;
    
    // If value is 0 or empty, revert to original price silently
    if (numericValue === 0 || value.trim() === '') {
      // Find the original price from the stock data
      const originalStock = sortedStocks.find(s => s.ID === id) || 
                           compatibilityResults.find(s => s.ID === id);
      const originalPrice = originalStock ? (originalStock.SELL || originalStock.PRICE || 0) : 0;
      
      // Silently revert to original price (no error message)
      handleCartPriceChange(id, originalPrice);
    } else {
      // Save the new price
      handleCartPriceChange(id, numericValue);
    }
    
    setEditingPriceId(null);
  };

  // Handle price change while editing - only update raw value
  const handlePriceChange = (id, value) => {
    // Only allow numbers and decimal point
    let cleanValue = value.replace(/[^\d.]/g, '');
    // Only one decimal point
    cleanValue = cleanValue.replace(/(\..*)\./g, '$1');
    // Limit to two decimal places
    if (cleanValue.includes('.')) {
      const [intPart, decPart] = cleanValue.split('.');
      cleanValue = intPart + '.' + decPart.slice(0, 2);
    }
    
    // Allow "0" to be typed since we start with "0" on focus
    // This allows users to type "0" and then continue with more digits
    
    // Update the raw value in state (temporary)
    setSelectedStocks(prev => prev.map(s => 
      s.ID === id ? { ...s, _rawPrice: cleanValue } : s
    ));
  };



  // Helper function to get max quantity for a stock item
  const getMaxQuantity = (stockId) => {
    // First, check if the item is already in the cart - use its stored QTY
    const cartItem = selectedStocks.find(s => s.ID === stockId);
    if (cartItem && (cartItem.QTY !== undefined || cartItem.QUANTITY !== undefined)) {
      return Math.max(0, parseInt(cartItem.QTY || cartItem.QUANTITY) || 0);
    }
    
    // If not in cart, check currently displayed stocks
    let stockItem = sortedStocks.find(s => s.ID === stockId);
    
    // If not found in main stocks, check compatibility results
    if (!stockItem) {
      stockItem = compatibilityResults.find(s => s.ID === stockId);
    }
    
    return stockItem ? Math.max(0, parseInt(stockItem.QTY || stockItem.QUANTITY) || 0) : 0;
  };

  // Add a handler to update quantity in the cart
  const handleCartQuantityChange = async (id, newQty) => {
    console.log('🔢 handleCartQuantityChange called:', { id, newQty });
    
    // First, check if the item is already in the cart - use its stored QTY
    let stockItem = selectedStocks.find(s => s.ID === id);
    let foundInCart = false;
    
    if (stockItem && (stockItem.QTY !== undefined || stockItem.QUANTITY !== undefined)) {
      foundInCart = true;
      console.log('🔢 Found in cart with QTY:', stockItem.QTY || stockItem.QUANTITY);
    } else {
      // If not found in cart, check currently displayed stocks
      stockItem = sortedStocks.find(s => s.ID === id);
      
      // If not found in main stocks, check compatibility results
      if (!stockItem) {
        stockItem = compatibilityResults.find(s => s.ID === id);
        console.log('🔢 Found in compatibility results:', stockItem);
      } else {
        console.log('🔢 Found in main stocks:', stockItem);
      }
    }
    
    if (!stockItem) {
      console.log('🔢 Stock item not found for ID:', id);
      // Even if not found in displayed stocks, still allow updating the cart quantity
      // This handles cases where items were added from previous searches
      setSelectedStocks(prev => {
        const updated = prev.map(s => s.ID === id ? { ...s, QUANTITY: Math.max(0, newQty) } : s);
        console.log('🔢 Updated selectedStocks (fallback):', updated);
        return updated;
      });
      return;
    }
    
    const availableQty = parseInt(stockItem.QTY || stockItem.QUANTITY) || 0;
    const maxAllowedQty = Math.max(0, availableQty);
    
    console.log('🔢 Available quantity:', availableQty, 'Max allowed:', maxAllowedQty);
    
    // Ensure quantity doesn't exceed available stock and is not negative
    const validatedQty = Math.max(0, Math.min(newQty, maxAllowedQty));
    
    console.log('🔢 Validated quantity:', validatedQty);
    
    // Only update if the quantity is valid
    if (validatedQty !== newQty) {
      // Show a brief alert if user tried to exceed available stock
      if (newQty > maxAllowedQty) {
        await showAlert(`Maximum available quantity for this item is ${maxAllowedQty}`, 'Maximum Quantity Reached');
      }
    }
    
    setSelectedStocks(prev => {
      const updated = prev.map(s => {
        if (s.ID === id) {
          // If we found it in cart, preserve all the original data
          const updatedItem = { ...s, QUANTITY: validatedQty };
          // If we found it in cart, make sure we preserve the QTY field for future lookups
          if (foundInCart && stockItem.QTY !== undefined) {
            updatedItem.QTY = stockItem.QTY;
          }
          return updatedItem;
        }
        return s;
      });
      console.log('🔢 Updated selectedStocks:', updated);
      return updated;
    });
  };

  return (
    <div className="pos-stock pos-stock-modern" style={{
      display: 'flex',
      gap: '20px',
      height: 'calc(100vh - 120px)',
      overflow: 'hidden'
    }}>
      <style>{tableStyles}</style>
      
      {/* Main Content Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0
      }}>
            {/* Search and Filters */}
      <div className="pos-stock-controls" style={{ gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
        <div className="pos-search-container" style={{ maxWidth: '300px', position: 'relative' }}>
          <Search className="pos-search-icon" />
          <input
            type="text"
            placeholder="Search by BENZ, ALTNO, Brand, or Remarks..."
            value={searchTerm}
            onChange={handleSearchChange}
            onKeyPress={async (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                // First perform the search
                handleSearchSubmit();
                // Then trigger Find Compatible if conditions are met
                if (searchTerm.trim() && !isBrandSearch && !compatibilityLoading) {
                  await handleCompatibilitySearch();
                }
              }
            }}
            className="pos-search-input"
          />
        </div>

        {/* Find Compatible Button */}
        <button
          onClick={handleCompatibilitySearch}
          disabled={compatibilityLoading || !searchTerm.trim() || isBrandSearch}
          className="pos-stock-action-btn"
          title={isBrandSearch ? "Compatibility search only works with specific part numbers, not brand names" : ""}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            padding: '12px 20px',
            fontSize: '12px',
            height: '40px',
            opacity: (compatibilityLoading || !searchTerm.trim() || isBrandSearch) ? 0.6 : 1,
            cursor: (compatibilityLoading || !searchTerm.trim() || isBrandSearch) ? 'not-allowed' : 'pointer',
            background: compatibilityLoading ? '#6c757d' : '#007bff',
            boxShadow: (compatibilityLoading || !searchTerm.trim() || isBrandSearch) ? 'none' : '0 2px 6px rgba(0, 123, 255, 0.3)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (!compatibilityLoading && searchTerm.trim() && !isBrandSearch) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 123, 255, 0.5)';
            }
          }}
          onMouseLeave={(e) => {
            if (!compatibilityLoading && searchTerm.trim() && !isBrandSearch) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 123, 255, 0.3)';
            }
          }}
        >
          {compatibilityLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Package className="w-4 h-4" />
          )}
          {compatibilityLoading ? 'Finding...' : 'Find Compatible'}
        </button>



        <div className="pos-filter-container">
          <Filter className="pos-filter-icon" />
          <select
            value={stockFilter}
            onChange={handleFilterChange}
            onClick={handleFilterClick}
            className="pos-filter-select"
          >
            <option value="in-stock">In Stock Only</option>
            <option value="all">All Items</option>
            <option value="out-of-stock">Out of Stock</option>
            <option value="low-stock">Low Stock</option>
          </select>
        </div>
        {/* Sort - match All Items filter structure */}
        <div className="pos-filter-container">
          <ArrowDownWideNarrow className="pos-filter-icon" />
          <select
            className="pos-filter-select"
            value={sortDropdown}
            onChange={e => setSortDropdown(e.target.value)}
            onClick={handleFilterClick}
            aria-label="Sort"
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        
        {/* Action Buttons Row */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
          {/* Cart Toggle Button */}
          <button
            onClick={() => setCartOpen(!cartOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              background: cartOpen ? 'rgba(0, 123, 255, 0.2)' : 'rgba(108, 117, 125, 0.2)',
              border: cartOpen ? '1px solid #007bff' : '1px solid #6c757d',
              borderRadius: '8px',
              color: cartOpen ? '#007bff' : '#6c757d',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
            }}
            title={cartOpen ? 'Hide Cart' : 'Show Cart'}
          >
            <Cart size={16} />
            <span>Cart {selectedStocks.length > 0 && `(${selectedStocks.length})`}</span>
          </button>

          {/* Held Orders Button */}
          <button
            onClick={() => setShowHeldOrdersModal(true)}
            disabled={heldOrders.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              background: heldOrders.length > 0 ? 'rgba(156, 39, 176, 0.2)' : 'rgba(108, 117, 125, 0.2)',
              border: heldOrders.length > 0 ? '1px solid #9c27b0' : '1px solid #6c757d',
              borderRadius: '8px',
              color: heldOrders.length > 0 ? '#9c27b0' : '#6c757d',
              cursor: heldOrders.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              opacity: heldOrders.length === 0 ? 0.5 : 1,
              boxShadow: heldOrders.length === 0 ? 'none' : '0 2px 4px rgba(156, 39, 176, 0.2)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (heldOrders.length > 0) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(156, 39, 176, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (heldOrders.length > 0) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(156, 39, 176, 0.2)';
              }
            }}
            title={heldOrders.length > 0 ? `${heldOrders.length} held order(s) - Click to view` : 'No held orders'}
          >
            <Bookmark size={16} />
            <span>Held Orders {heldOrders.length > 0 && `(${heldOrders.length})`}</span>
          </button>

          {/* Export to Excel Button */}
        </div>
      </div>

            {/* Error Message */}
      {error && (
        <div className="pos-error-message">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="pos-success-message" style={{
          background: '#d4edda',
          color: '#155724',
          border: '1px solid #c3e6cb',
          borderRadius: '4px',
          padding: '12px',
          margin: '10px 0',
          fontSize: '14px'
        }}>
          {successMessage}
        </div>
      )}

      {/* Stock Items Table */}
      <div className="pos-stock-content" style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Recent Items View Indicator */}
        {showingRecentItems && (
          <div style={{
            background: 'linear-gradient(135deg, #007bff, #0056b3)',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(0, 123, 255, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <span style={{ fontWeight: '600' }}>
                Showing first 200 most recent stock items (sorted by highest ID first)
              </span>
            </div>
            <button
              onClick={() => {
                setShowingRecentItems(false);
                setShowRecentSort(false);
                setSearchTerm('');
                setStockFilter('in-stock');
                fetchStocks(1, '', 'in-stock', 'recent');
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
              onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
            >
              Exit Recent View
            </button>
          </div>
        )}
        
        <div className="pos-stock-table-container">
          {/* Mutually exclusive rendering: only one of these shows at a time */}
          {!searchTerm && (!sortedStocks || sortedStocks.length === 0) ? (
            <div className="pos-empty-state">
              <Package className="pos-empty-icon" />
              <h3>Search for Stock Items</h3>
              <p>Enter a search term above to view stock items</p>
            </div>
          ) : !sortedStocks || sortedStocks.length === 0 ? (
            <div className="pos-empty-state">
              <Package className="pos-empty-icon" />
              <h3>No items found</h3>
              <p>Try adjusting your search criteria</p>
            </div>
          ) : (
            <div className="pos-stock-table-wrapper" style={{
              flex: 1,
              overflow: 'auto',
              borderRadius: '8px'
            }}>
              <table className="pos-stock-table" style={{ tableLayout: 'auto', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ 
                      padding: largeFontMode ? '16px 20px' : '12px 16px',
                      fontSize: `${getFontSize(14)}px`,
                      width: '50px'
                    }}>
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        aria-label="Select All"
                        className="pos-checkbox"
                        style={{
                          width: largeFontMode ? '22px' : '18px',
                          height: largeFontMode ? '22px' : '18px'
                        }}
                      />
                    </th>
                    <th style={{ 
                      padding: largeFontMode ? '16px 4px 16px 20px' : '12px 4px 12px 16px',
                      fontSize: `${getFontSize(16)}px`,
                      width: '220px'
                    }}>Part No.</th>
                    <th style={{ 
                      padding: largeFontMode ? '16px 8px 16px 4px' : '12px 8px 12px 4px',
                      fontSize: `${getFontSize(16)}px`,
                      width: '110px'
                    }}>ID</th>
                    <th style={{ 
                      padding: largeFontMode ? '16px 8px' : '12px 8px',
                      fontSize: `${getFontSize(16)}px`,
                      width: '140px'
                    }}>Brand</th>
                    <th style={{ 
                      padding: largeFontMode ? '16px 20px' : '12px 16px',
                      fontSize: `${getFontSize(16)}px`,
                      width: '160px'
                    }}>OEM</th>
                    <th style={{ 
                      padding: largeFontMode ? '16px 20px' : '12px 16px',
                      fontSize: `${getFontSize(16)}px`,
                      width: '220px'
                    }}>Description</th>
                    <th style={{ 
                      padding: largeFontMode ? '16px 20px' : '12px 16px',
                      fontSize: `${getFontSize(16)}px`,
                      width: '120px'
                    }}>Date</th>
                    {/* <th>Barcode</th> */}
                    {/* <th>QR Code</th> */}
                    <th style={{ 
                      padding: largeFontMode ? '16px 20px' : '12px 16px',
                      fontSize: `${getFontSize(16)}px`,
                      width: '110px'
                    }}>Quantity</th>
                    <th style={{ 
                      padding: largeFontMode ? '16px 20px' : '12px 16px',
                      fontSize: `${getFontSize(16)}px`,
                      width: '130px'
                    }}>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {(sortedStocks || []).map((stock) => {
                    const serviceInfo = getServiceInfo(stock.ID, serviceData);
                    console.log(`🔧 Stock ${stock.ID}: serviceInfo =`, serviceInfo, 'serviceData =', serviceData);
                    return (
                    <tr 
                      key={stock.ID} 
                      className={`pos-stock-row ${stock.QUANTITY <= 0 ? 'out-of-stock' : ''} ${serviceInfo ? 'in-service' : ''} ${selectedStocks.some(s => s.ID === stock.ID) ? 'selected' : ''}`}
                      style={serviceInfo ? { 
                        backgroundColor: 'rgba(255, 193, 7, 0.15) !important',
                        borderLeft: '3px solid #f59e0b'
                      } : {}}
                      onClick={(e) => handleRowClick(e, stock.ID)}
                    >
                      <td style={{ 
                        padding: largeFontMode ? '14px 20px' : '12px 16px'
                      }}>
                        <input
                          type="checkbox"
                          checked={selectedStocks.some(s => s.ID === stock.ID)}
                          onChange={() => { console.log('[CHECKBOX CLICK]', stock.ID, stock); handleSelectRow(stock.ID); }}
                          aria-label="Select Row"
                          className="pos-checkbox"
                          disabled={stock.QUANTITY <= 0}
                          style={{
                            width: largeFontMode ? '22px' : '18px',
                            height: largeFontMode ? '22px' : '18px'
                          }}
                        />
                      </td>
                      <td className="pos-stock-cell" style={{ 
                        padding: largeFontMode ? '14px 4px 14px 20px' : '12px 4px 12px 16px',
                        fontSize: `${getFontSize(20)}px`,
                        fontWeight: '700',
                        fontFamily: 'monospace',
                        width: '220px',
                        whiteSpace: 'normal',
                        overflow: 'visible',
                        textOverflow: 'clip'
                      }} title={stock.BENZ + (stock.BENZ2 ? ' / ' + stock.BENZ2 : '') + (stock.BENZ3 ? ' / ' + stock.BENZ3 : '')}>
                        <div className="benz-numbers" style={{ whiteSpace: 'normal', overflow: 'visible' }}>
                          <span 
                            className={stock.match_type === 'primary' ? 'benz-primary-match' : ''} 
                            style={{ 
                              whiteSpace: 'nowrap', 
                              display: 'block',
                              cursor: 'pointer'
                            }}
                            onClick={(e) => handleBenzClick(e, stock.BENZ, stock.BRAND, stock.ALTNO, stock.DESCRIPTION || stock.REMARKS, stock.APPLICATION || stock.APPL)}
                            title="Click to view movement history"
                          >
                            {stock.BENZ}
                            {stock.match_type === 'primary' && <span className="match-indicator">★</span>}
                          </span>
                          {stock.BENZ2 && (
                            <span 
                              className={`benz-secondary ${stock.match_type === 'secondary' ? 'benz-secondary-match' : ''}`} 
                              style={{ 
                                whiteSpace: 'nowrap', 
                                display: 'block', 
                                fontSize: '0.9em', 
                                color: 'var(--text-muted)',
                                cursor: 'pointer'
                              }}
                              onClick={(e) => handleBenzClick(e, stock.BENZ2, stock.BRAND, stock.ALTNO, stock.DESCRIPTION || stock.REMARKS, stock.APPLICATION || stock.APPL)}
                              title="Click to view movement history"
                            >
                              {stock.BENZ2}
                              {stock.match_type === 'secondary' && <span className="match-indicator">★</span>}
                            </span>
                          )}
                          {stock.BENZ3 && (
                            <span 
                              className={`benz-secondary ${stock.match_type === 'tertiary' ? 'benz-tertiary-match' : ''}`} 
                              style={{ 
                                whiteSpace: 'nowrap', 
                                display: 'block', 
                                fontSize: '0.9em', 
                                color: 'var(--text-muted)',
                                cursor: 'pointer'
                              }}
                              onClick={(e) => handleBenzClick(e, stock.BENZ3, stock.BRAND, stock.ALTNO, stock.DESCRIPTION || stock.REMARKS, stock.APPLICATION || stock.APPL)}
                              title="Click to view movement history"
                            >
                              {stock.BENZ3}
                              {stock.match_type === 'tertiary' && <span className="match-indicator">★</span>}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="pos-stock-cell" style={{ 
                        padding: largeFontMode ? '14px 8px 14px 4px' : '12px 8px 12px 4px',
                        fontSize: `${getFontSize(20)}px`,
                        fontWeight: '700',
                        fontFamily: 'monospace',
                        width: '110px',
                        color: '#ffc107'
                      }}>{stock.ID}</td>
                      <td className="pos-stock-cell" style={{ 
                        padding: largeFontMode ? '14px 8px' : '12px 8px',
                        fontSize: `${getFontSize(16)}px`,
                        width: '140px'
                      }} title={stock.BRAND}>{stock.BRAND}</td>
                      <td className="pos-stock-cell" style={{ 
                        padding: largeFontMode ? '14px 20px' : '12px 16px',
                        fontSize: `${getFontSize(16)}px`,
                        fontWeight: 'normal',
                        width: '160px'
                      }} title={stock.ALTNO}>
                        {(() => {
                          // Check if there's no part number (BENZ, BENZ2, BENZ3)
                          const hasPartNo = stock.BENZ || stock.BENZ2 || stock.BENZ3;
                          const hasAltno = stock.ALTNO && stock.ALTNO.trim() !== '';
                          
                          // If no part number but has ALTNO, make it clickable
                          if (!hasPartNo && hasAltno) {
                            return (
                              <span
                                style={{
                                  cursor: 'pointer',
                                  color: 'inherit'
                                }}
                                onClick={(e) => handleBenzClick(e, stock.ALTNO, stock.BRAND, stock.ALTNO, stock.DESCRIPTION || stock.REMARKS, stock.APPLICATION || stock.APPL)}
                                title="Click to view movement history"
                              >
                                {stock.ALTNO}
                              </span>
                            );
                          }
                          // Otherwise, just display normally
                          return stock.ALTNO;
                        })()}
                      </td>
                      <td className="pos-stock-cell description-cell" style={{ 
                        padding: largeFontMode ? '14px 20px' : '12px 16px',
                        fontSize: `${getFontSize(16)}px`,
                        fontWeight: 'normal',
                        width: '220px'
                      }} title={stock.DESCRIPTION}>
                        <div className="description-text">
                          {stock.DESCRIPTION || 'No description'}
                        </div>
                      </td>
                      <td className="pos-stock-cell" style={{ 
                        padding: largeFontMode ? '14px 20px' : '12px 16px',
                        fontSize: `${getFontSize(16)}px`,
                        fontWeight: 'normal',
                        width: '120px'
                      }}>{formatDateShort(stock.DATE)}</td>
                      {/* <td className="pos-stock-cell">
                        <Barcode value={String(stock.ID)} width={1.2} height={40} fontSize={12} displayValue={false} />
                      </td>
                      <td className="pos-stock-cell">
                        <QRCodeSVG value={String(stock.ID)} size={48} level="M" />
                      </td> */}
                      <td className="pos-stock-cell" style={{ 
                        padding: largeFontMode ? '14px 20px' : '12px 16px',
                        fontSize: `${getFontSize(16)}px`,
                        width: '110px'
                      }}>
                        {(() => {
                          // Find if this stock is in the cart
                          const cartItem = selectedStocks.find(s => s.ID === stock.ID);
                          const availableQty = Math.max(0, (parseInt(stock.QTY) || 0) - (cartItem ? (parseInt(cartItem.QUANTITY) || 0) : 0));
                          const serviceInfo = getServiceInfo(stock.ID, serviceData);
                          
                          // Show service info even if stock quantity is 0
                          const showServiceInfo = serviceInfo && serviceInfo.totalQuantity > 0;
                          
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <span className={`quantity-badge${availableQty <= 0 ? ' out-of-stock' : availableQty <= 5 ? ' low-stock' : ' in-stock'}`}
                                style={{
                                  ...(availableQty <= 0 ? { background: '#dc3545', color: '#fff' } : {}),
                                  padding: largeFontMode ? '6px 12px' : '4px 8px',
                                  fontSize: `${getFontSize(13)}px`,
                                  fontWeight: '600'
                                }}>
                                {formatNumber(availableQty)}
                              </span>
                              {showServiceInfo && (
                                <div style={{ 
                                  fontSize: `${getFontSize(11)}px`, 
                                  color: '#f59e0b', 
                                  textAlign: 'center',
                                  fontWeight: '600',
                                  background: 'rgba(255, 193, 7, 0.15)',
                                  padding: largeFontMode ? '4px 8px' : '2px 6px',
                                  borderRadius: '4px',
                                  border: '1px solid rgba(255, 193, 7, 0.3)'
                                }}>
                                  Service: {serviceInfo.totalQuantity}
                                  <br />
                                  Orders: {serviceInfo.orderIds.join(', ')}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="pos-stock-cell" style={{ 
                        padding: largeFontMode ? '14px 20px' : '12px 16px',
                        fontSize: `${getFontSize(16)}px`,
                        fontWeight: 'bold',
                        width: '130px',
                        textAlign: 'right'
                      }}>{formatCurrency(stock.PRICE)}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Compatibility Results */}
          {console.log('🔗 UI Debug - showCompatibilityResults:', showCompatibilityResults, 'compatibilityResults.length:', compatibilityResults.length)}
          {(() => {
            // Filter out items with 0 quantity (frontend only)
            const filteredCompatibilityResults = compatibilityResults.filter(part => {
              // Get quantity from various possible field names
              const qtyValue = part.QTY ?? part.quantity ?? part.QUANTITY ?? 0;
              // Convert to number, handling string "0", null, undefined, etc.
              const qty = Number(qtyValue);
              // Only include items with quantity greater than 0
              return !isNaN(qty) && qty > 0;
            });
            
            return showCompatibilityResults && filteredCompatibilityResults.length > 0 && (
            <div className="pos-stock-table-container" style={{ marginTop: '20px' }}>
              <div style={{ 
                background: 'var(--bg-secondary)', 
                padding: '16px', 
                borderRadius: '8px 8px 0 0',
                borderBottom: '2px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{ 
                  color: 'var(--text-primary)', 
                  margin: '0', 
                  fontSize: '1.1em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Package className="w-5 h-5" />
                  Compatible Parts Found ({filteredCompatibilityResults.length})
                </h3>
                <button
                  onClick={() => setShowCompatibilityResults(false)}
                  className="pos-stock-action-btn"
                  style={{ 
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9em',
                    fontWeight: '600'
                  }}
                >
                  Close
                </button>
              </div>
              
              <div className="pos-stock-table-wrapper">
                <table className="pos-stock-table">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={filteredCompatibilityResults.every(part => selectedStocks.some(s => s.ID === part.ID))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              // Add all compatibility parts to cart
                              const partsToAdd = filteredCompatibilityResults
                                .filter(part => !selectedStocks.some(s => s.ID === part.ID))
                                .map(part => ({
                                  ...part,
                                  QUANTITY: 1,
                                  BENZ: part.BENZ,
                                  BRAND: part.BRAND,
                                  ALTNO: part.ALTNO,
                                  DESCRIPTION: part.DESCRIPTION || part.REMARKS,
                                  PRICE: part.SELL,
                                  QTY: part.QTY,
                                  // Add originalData with proper structure for warehouse submission
                                  originalData: {
                                    id: part.ID,
                                    BENZ: part.BENZ,
                                    BRAND: part.BRAND,
                                    ALTNO: part.ALTNO,
                                    DESCRIPTION: part.DESCRIPTION || part.REMARKS,
                                    SELL: part.SELL,
                                    QTY: part.QTY
                                  }
                                }));
                              setSelectedStocks(prev => [...prev, ...partsToAdd]);
                            } else {
                              // Remove all compatibility parts from cart
                              const compatibilityIds = filteredCompatibilityResults.map(part => part.ID);
                              setSelectedStocks(prev => prev.filter(s => !compatibilityIds.includes(s.ID)));
                            }
                          }}
                          aria-label="Select All Compatible Parts"
                          className="pos-checkbox"
                        />
                      </th>
                      <th>Part No.</th>
                      <th>Brand</th>
                      <th>OEM</th>
                      <th>Description</th>
                      <th>ID</th>
                      <th>Date</th>
                      <th>Quantity</th>
                      <th>Price</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompatibilityResults.map((part, index) => {
                      const serviceInfo = getServiceInfo(part.ID, serviceData);
                      return (
                      <tr key={`${part.ID}-${index}`} className={`pos-stock-row ${part.QTY <= 0 ? 'out-of-stock' : ''} ${serviceInfo ? 'in-service' : ''} ${selectedStocks.some(s => s.ID === part.ID) ? 'selected' : ''}`} style={serviceInfo ? { 
                        backgroundColor: 'rgba(255, 193, 7, 0.15) !important',
                        borderLeft: '3px solid #f59e0b'
                      } : {}}
                      onClick={(e) => handleCompatibilityRowClick(e, part)}
                      >
                        <td>
                                                  <input
                          type="checkbox"
                          checked={selectedStocks.some(s => s.ID === part.ID)}
                          onChange={() => handleCompatibilitySelectRow(part)}
                          className="pos-checkbox"
                          disabled={part.QTY <= 0}
                        />
                        </td>
                        <td className="pos-stock-cell">
                          <div style={{ fontWeight: '600' }}>{part.BENZ}</div>
                          {part.BENZ2 && part.BENZ2 !== '-' && (
                            <div style={{ fontSize: '0.85em', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {part.BENZ2}
                            </div>
                          )}
                          {part.BENZ3 && part.BENZ3 !== '-' && (
                            <div style={{ fontSize: '0.85em', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {part.BENZ3}
                            </div>
                          )}
                        </td>
                        <td className="pos-stock-cell">{part.BRAND}</td>
                        <td className="pos-stock-cell">{part.ALTNO}</td>
                        <td className="pos-stock-cell" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {part.DESCRIPTION || part.REMARKS || '-'}
                        </td>
                        <td className="pos-stock-cell" style={{ fontWeight: '600' }}>{part.ID || '-'}</td>
                        <td className="pos-stock-cell">{formatDateShort(part.DATE)}</td>
                        <td className="pos-stock-cell" style={{ textAlign: 'center' }}>
                          {(() => {
                            // Find if this part is in the cart
                            const cartItem = selectedStocks.find(s => s.ID === part.ID);
                            const availableQty = Math.max(0, (parseInt(part.QTY) || 0) - (cartItem ? (parseInt(cartItem.QUANTITY) || 0) : 0));
                            const serviceInfo = getServiceInfo(part.ID, serviceData);
                            
                            // Show service info even if stock quantity is 0
                            const showServiceInfo = serviceInfo && serviceInfo.totalQuantity > 0;
                            
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                <span className={`quantity-badge${availableQty <= 0 ? ' out-of-stock' : availableQty <= 5 ? ' low-stock' : ' in-stock'}`}
                                  style={availableQty <= 0 ? { background: '#dc3545', color: '#fff' } : {}}>
                                  {availableQty}
                                </span>
                                {showServiceInfo && (
                                <div style={{ 
                                  fontSize: '10px', 
                                  color: '#f59e0b', 
                                  textAlign: 'center',
                                  fontWeight: '600',
                                  background: 'rgba(255, 193, 7, 0.15)',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  border: '1px solid rgba(255, 193, 7, 0.3)'
                                }}>
                                    Service: {serviceInfo.totalQuantity}
                                    <br />
                                    Orders: {serviceInfo.orderIds.join(', ')}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="pos-stock-cell" style={{ textAlign: 'right' }}>
                          {part.SELL ? `₱${parseFloat(part.SELL).toLocaleString()}` : '-'}
                        </td>
                        <td className="pos-stock-cell" style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                            {part.isCompatible ? (
                              <span style={{
                                background: part.compatibilityType === 'brand-altno' ? '#f59e0b' : '#10b981',
                                color: 'white',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '0.8em',
                                fontWeight: '600'
                              }}>
                                {part.compatibilityType === 'fuzzy' ? 'Compatible' : 
                                 part.compatibilityType === 'brand-altno' ? 'Brand+Alt' : 'Compatible'}
                              </span>
                            ) : (
                              <span style={{
                                background: '#3b82f6',
                                color: 'white',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '0.8em',
                                fontWeight: '600'
                              }}>
                                Original
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
            </div>
          );
          })()}

          {/* Pagination - only show when there are results and a search term */}
          {searchTerm && totalPages > 1 && (
            <div className="pos-pagination">
              <button
                className="pos-pagination-btn"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span className="pos-pagination-info">
                Page {currentPage} of {totalPages} ({formatNumber(totalItems)} items total)
              </span>
              <button
                className="pos-pagination-btn"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="pos-modal-overlay" onClick={handleModalClose}>
          <div className="pos-modal stock-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pos-modal-header">
              <h2>{isAddingNew ? 'Add New Stock Item' : 'Edit Stock Item'}</h2>
              <button className="pos-modal-close" onClick={handleModalClose}>×</button>
            </div>
            <form onSubmit={handleModalSave} className="pos-modal-form stock-edit-form">
              {/* Basic Information Section */}
              <div className="form-section">
                <h3 className="section-title">Basic Information</h3>
                <div className="form-row">
                  <div className="pos-form-group">
                    <label>ID</label>
                    <input 
                      type="text" 
                      name="ID" 
                      value={modalForm.ID || ''} 
                      onChange={handleModalFormChange}
                      disabled={!isAddingNew}
                      className="pos-form-input" 
                    />
                  </div>
                  <div className="pos-form-group">
                    <label>Date</label>
                    <input type="text" name="DATE" value={modalForm.DATE || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>Reference</label>
                    <input type="text" name="REFERENCE" value={modalForm.REFERENCE || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                </div>
              </div>

              {/* Product Details Section */}
              <div className="form-section">
                <h3 className="section-title">Product Details</h3>
                <div className="form-row">
                  <div className="pos-form-group">
                    <label>Brand</label>
                    <input type="text" name="BRAND" value={modalForm.BRAND || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>OEM#</label>
                    <input type="text" name="OEM" value={modalForm.OEM || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>DIN</label>
                    <input type="text" name="DINFLAG" value={modalForm.DINFLAG || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                </div>
              </div>

              {/* Part Numbers Section */}
              <div className="form-section">
                <h3 className="section-title">Part Numbers</h3>
                <div className="form-row">
                  <div className="pos-form-group">
                    <label>ALTNO</label>
                    <input type="text" name="ALTNO" value={modalForm.ALTNO || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>ALTNO2</label>
                    <input type="text" name="ALTNO2" value={modalForm.ALTNO2 || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="pos-form-group">
                    <label>Benz 1</label>
                    <input type="text" name="BENZ" value={modalForm.BENZ || ''} onChange={handleModalFormChange} className="pos-form-input" placeholder="BENZ" />
                  </div>
                  <div className="pos-form-group">
                    <label>Benz 2</label>
                    <input type="text" name="BENZ2" value={modalForm.BENZ2 || ''} onChange={handleModalFormChange} className="pos-form-input" placeholder="BENZ2" />
                  </div>
                  <div className="pos-form-group">
                    <label>Benz 3</label>
                    <input type="text" name="BENZ3" value={modalForm.BENZ3 || ''} onChange={handleModalFormChange} className="pos-form-input" placeholder="BENZ3" />
                  </div>
                </div>
              </div>

              {/* Description Section */}
              <div className="form-section">
                <h3 className="section-title">Description & Application</h3>
                <div className="form-row">
                  <div className="pos-form-group">
                    <label>Description</label>
                    <input type="text" name="DESCRIPTION" value={modalForm.DESCRIPTION || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>Application</label>
                    <input type="text" name="APPLICATION" value={modalForm.APPLICATION || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="pos-form-group color-code-field" style={{display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '12px'}}>
                    <label style={{fontSize: '0.85rem', fontWeight: '600', color: '#e0e0e0', marginBottom: '0', whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'unset', minWidth: 'fit-content', width: 'auto', maxWidth: 'none', display: 'block', flexShrink: '0', paddingTop: '8px', background: 'rgba(0, 255, 0, 0.2)', border: '2px solid rgba(0, 255, 0, 0.5)', padding: '4px 8px'}}>Color Code</label>
                    <input type="text" name="COLORCODE" value={modalForm.COLORCODE || ''} onChange={handleModalFormChange} className="pos-form-input" style={{width: '100%', marginTop: '0', flex: '1'}} />
                  </div>
                  <div className="pos-form-group remarks-field" style={{display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '12px'}}>
                    <label style={{fontSize: '0.85rem', fontWeight: '600', color: '#e0e0e0', marginBottom: '0', whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'unset', minWidth: 'fit-content', width: 'auto', maxWidth: 'none', display: 'block', flexShrink: '0', paddingTop: '8px', background: 'rgba(255, 0, 0, 0.2)', border: '2px solid rgba(255, 0, 0, 0.5)', padding: '4px 8px'}}>Remarks</label>
                    <input type="text" name="REMARKS" value={modalForm.REMARKS || ''} onChange={handleModalFormChange} className="pos-form-input" style={{width: '100%', marginTop: '0', flex: '1'}} />
                  </div>
                </div>
              </div>

              {/* Pricing Section */}
              <div className="form-section">
                <h3 className="section-title">Pricing & Currency</h3>
                <div className="form-row">
                  <div className="pos-form-group">
                    <label>Cost</label>
                    <input type="number" step="0.01" name="COST" value={modalForm.COST || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>Sell Price</label>
                    <input type="number" step="0.01" name="SELL" value={modalForm.SELL || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>Currency</label>
                    <input type="text" name="CURRENCY" value={modalForm.CURRENCY || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="pos-form-group">
                    <label>FC Cost</label>
                    <input type="number" step="0.01" name="FC_COST" value={modalForm.FC_COST || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>FC Amount</label>
                    <input type="number" step="0.01" name="FCAMOUNT" value={modalForm.FCAMOUNT || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>Conversion</label>
                    <input type="number" step="0.01" name="CONVERSION" value={modalForm.CONVERSION || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                </div>
              </div>

              {/* Inventory Section */}
              <div className="form-section">
                <h3 className="section-title">Inventory</h3>
                <div className="form-row">
                  <div className="pos-form-group">
                    <label>Quantity</label>
                    <input type="number" name="QTY" value={modalForm.QTY || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>Unit</label>
                    <input type="text" name="UNIT" value={modalForm.UNIT || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>Location</label>
                    <input type="text" name="LOCATION" value={modalForm.LOCATION || ''} onChange={handleModalFormChange} className="pos-form-input" />
                  </div>
                </div>
              </div>

              {/* Additional Fields */}
              {editingStock && Object.entries(editingStock.originalData)
                .filter(([key]) => {
                  const normalized = key.toLowerCase().replace(/_/g, '');
                  return ![
                    'id','date','reference','dinflag','benz','benz2','benz3','brand','oem','altno','altno2','description','application','appl','colorcode','remarks','cost','sell','sellingprice','currency','fccost','fcamount','conversion','qty','quantity','unit','location','documentreference','createdat'
                  ].includes(normalized);
                })
                .length > 0 && (
                <div className="form-section">
                  <h3 className="section-title">Additional Information</h3>
                  <div className="form-row">
                    {editingStock && Object.entries(editingStock.originalData)
                      .filter(([key]) => {
                        const normalized = key.toLowerCase().replace(/_/g, '');
                        return ![
                          'id','date','reference','dinflag','benz','benz2','benz3','brand','oem','altno','altno2','description','application','appl','colorcode','remarks','cost','sell','sellingprice','currency','fccost','fcamount','conversion','qty','quantity','unit','location','documentreference','createdat'
                        ].includes(normalized);
                      })
                      .map(([key, value]) => (
                        <div className="pos-form-group" key={key}>
                          <label style={{ textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</label>
                          <input type="text" name={key} value={modalForm[key] !== undefined ? modalForm[key] : value || ''} onChange={handleModalFormChange} className="pos-form-input" />
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="pos-modal-actions">
                <button type="button" className="pos-btn pos-btn-secondary" onClick={handleModalClose}>
                  Cancel
                </button>
                <button type="submit" className="pos-btn pos-btn-primary">
                  {isAddingNew ? 'Add Item' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request Modal */}
      {showRequestModal && (
        <div className="pos-modal-overlay" onClick={handleRequestModalClose}>
          <div className="pos-modal stock-request-modal" onClick={e => e.stopPropagation()}>
            <div className="pos-modal-header">
              <h2>Request Stock</h2>
              <button className="pos-modal-close" onClick={handleRequestModalClose}>×</button>
            </div>
            <form onSubmit={handleRequestSubmit} className="pos-modal-form stock-request-form">
              <div className="form-section">
                <h3 className="section-title">Request Details</h3>
                <div className="form-row">
                  <div className="pos-form-group">
                    <label>Part No.</label>
                    <input type="text" value={requestingStock?.BENZ || ''} disabled className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>OEM</label>
                    <input type="text" value={requestingStock?.ALTNO || ''} disabled className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>Brand</label>
                    <input type="text" value={requestingStock?.BRAND || ''} disabled className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>Description</label>
                    <input type="text" value={requestingStock?.DESCRIPTION || requestingStock?.ID || ''} disabled className="pos-form-input" />
                  </div>
                  <div className="pos-form-group">
                    <label>Reason</label>
                    <textarea value={requestReason} onChange={e => setRequestReason(e.target.value)} required className="pos-form-input" placeholder="Reason for request (e.g. restock, add new, etc.)" />
                  </div>
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="pos-stock-action-btn">Submit Request</button>
                <button type="button" className="pos-stock-action-btn" onClick={handleRequestModalClose}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scan Modal */}
      {scanModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'var(--modal-overlay)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-content" style={{ background: 'var(--card-bg)', padding: 32, borderRadius: 8, minWidth: 320, maxWidth: 400, color: 'var(--text-primary)', textAlign: 'center', border: '1px solid var(--border-color)' }}>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: 16 }}>Scan Barcode or QR Code</h2>
            <QrReader
              delay={300}
              onError={err => console.error(err)}
              onScan={data => {
                if (data) {
                  handleBarcodeScan(data);
                }
              }}
              style={{ width: '100%', marginBottom: 16 }}
            />
            <input
              type="text"
              placeholder="Or scan with hardware scanner..."
              value={scannedValue}
              onChange={e => {
                setScannedValue(e.target.value);
              }}
              onKeyPress={e => {
                if (e.key === 'Enter') {
                  handleBarcodeScan(e.target.value);
                }
              }}
              autoFocus
              style={{ width: '100%', padding: 8, marginBottom: 16, borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
            />
            <button className="pos-btn" onClick={() => setScanModalOpen(false)} style={{ marginTop: 8, padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}



      </div>
      
      {/* Cart/Side Panel - Fixed on Right */}
      {(cartOpen || selectedStocks.length > 0) && (
        <div className={`pos-cart-modal ${cartMinimized ? 'minimized' : ''}`} style={{ 
          minWidth: cartMinimized ? '60px' : '380px', 
          maxWidth: cartMinimized ? '60px' : '380px', 
          width: cartMinimized ? '60px' : '380px',
          borderRadius: cartMinimized ? '50%' : '12px', 
          padding: 0, 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100%',
          position: 'relative',
          flexShrink: 0,
          zIndex: 10,
          overflow: 'visible'
        }}>
          {console.log('🛒 Cart is rendering!', { cartOpen, selectedStocksLength: selectedStocks.length, cartMinimized })}
          {cartMinimized && selectedStocks.length > 0 && (
            <div className="cart-item-count">
              {selectedStocks.length}
            </div>
          )}
            <div className="pos-cart-modal-header" style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'flex-start', 
              borderTopLeftRadius: cartMinimized ? '50%' : '12px', 
              borderTopRightRadius: cartMinimized ? '50%' : '12px', 
              padding: cartMinimized ? '0' : largeFontMode ? '16px 16px 10px 16px' : '14px 16px 8px 16px',
              overflow: 'hidden'
            }}>
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 0 }}>
              <span className="cart-title" style={{ 
                fontWeight: 700, 
                fontSize: `${getFontSize(16)}px`, 
                color: 'var(--cart-title-color)', 
                letterSpacing: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
                minWidth: 0
              }}>Parts Requisition/Issuance Slip</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {!cartMinimized && (
                  <button 
                    className="cart-minimize-btn" 
                    onClick={() => setCartMinimized(true)}
                    title="Minimize cart"
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: 'var(--cart-title-color)', 
                      fontSize: '24px', 
                      cursor: 'pointer', 
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.2s ease',
                      borderRadius: '4px'
                    }}
                  >
                    −
                  </button>
                )}
                {cartMinimized && (
                  <button 
                    className="cart-maximize-btn" 
                    onClick={() => setCartMinimized(false)}
                    title="Maximize cart"
                    style={{ 
                      background: 'var(--bg-secondary)', 
                      border: '1px solid var(--border-color)', 
                      color: 'var(--text-primary)', 
                      fontSize: '18px', 
                      cursor: 'pointer', 
                      padding: '0', 
                      borderRadius: '50%',
                      width: '60px',
                      height: '60px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 2px 8px var(--shadow-md)',
                      position: 'relative',
                      margin: '0',
                      flex: 'none',
                      overflow: 'visible'
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m0 0h6m-6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
                    </svg>
                  </button>
                )}
                <button className="pos-cart-modal-close" style={{ fontSize: 22, color: 'var(--cart-title-color)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 12 }} onClick={() => {
                      if (addToOrderId) {
                        // If in "Add to Order" mode, navigate back to warehouses
                        navigate('/warehouses');
                      } else if (hasUnsavedCartItems()) {
                        setPendingNavigation(() => () => {
                          setCartOpen(false);
                          setSelectedStocks([]);
                          setOrderNumber(null);
                          setOrderId(null);
                          setCartMinimized(false);
                        });
                        setShowNavigationWarning(true);
                      } else {
                        setCartOpen(false);
                        setSelectedStocks([]);
                        setOrderNumber(null);
                        setOrderId(null);
                        setCartMinimized(false);
                      }
                    }}>×</button>
              </div>
            </div>
            {!cartMinimized && orderNumber && (
              <div style={{ marginTop: 8, fontWeight: 600, fontSize: 15, color: '#1976d2', letterSpacing: 1, background: 'var(--bg-tertiary)', padding: '4px 12px', borderRadius: 6, boxShadow: '0 2px 6px rgba(25, 118, 210, 0.2)' }}>
                Order Number: #{orderNumber}
              </div>
            )}
            {!cartMinimized && addToOrderId && (
              <div style={{ marginTop: 8, fontWeight: 600, fontSize: 15, color: '#17a2b8', letterSpacing: 1, background: 'var(--bg-tertiary)', padding: '4px 12px', borderRadius: 6, boxShadow: '0 2px 6px rgba(23, 162, 184, 0.2)' }}>
                Adding to Order #{addToOrderId}
              </div>
            )}
          </div>
             {!cartMinimized && (
               <>
                 <div className="pos-cart-list" style={{ 
                   padding: largeFontMode ? '20px 16px 0 16px' : '18px 16px 0 16px', 
                   flex: 1, 
                   minHeight: 0, 
                   overflowY: 'auto',
                   overflowX: 'visible'
                 }}>
                <div style={{ fontWeight: 600, color: 'var(--cart-title-color)', fontSize: 15, marginBottom: 8 }}>
                  {addToOrderId ? 'Items to Add' : 'Order Items'}
                </div>
            {[...selectedStocks].reverse().map(stock => (
                  <div
                    key={stock.ID || stock.id}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px', minWidth: 0 }}
                  >
                    <button
                      onClick={() => setSelectedStocks(selectedStocks.filter(s => s.ID !== stock.ID))}
                      style={{
                        background: 'rgba(220, 53, 69, 0.1)',
                        border: '1px solid rgba(220, 53, 69, 0.3)',
                        borderRadius: '6px',
                        width: largeFontMode ? 32 : 28,
                        height: largeFontMode ? 32 : 28,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#dc3545',
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(220, 53, 69, 0.2)'
                      }}
                      title="Remove"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(220, 53, 69, 0.2)';
                        e.currentTarget.style.borderColor = '#dc3545';
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(220, 53, 69, 0.4)';
                        e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(220, 53, 69, 0.1)';
                        e.currentTarget.style.borderColor = 'rgba(220, 53, 69, 0.3)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(220, 53, 69, 0.2)';
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                      }}
                    >
                      <Trash2 size={largeFontMode ? 16 : 14} />
                    </button>
                    <div 
                      className={stock.ID === lastAddedToCartId ? 'cart-item-just-added' : ''}
                      style={{ 
                        flex: 1, 
                        display: 'flex', 
                        flexDirection: 'column',
                        background: 'var(--card-bg)', 
                        borderRadius: 8, 
                        padding: largeFontMode ? '12px' : '10px', 
                        gap: largeFontMode ? '8px' : '6px',
                        border: '1px solid var(--border-color)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        minWidth: 0,
                        overflow: 'visible',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)',
                        transition: 'all 0.2s ease'
                      }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 6px rgba(0, 0, 0, 0.1)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                    >
                      {/* Row 1: PART NO (left) and ID (right) - BOLD */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: largeFontMode ? '6px' : '4px'
                      }}>
                        <div style={{ 
                          fontWeight: 'bold', 
                          color: 'var(--text-primary)', 
                          fontSize: `${getFontSize(18)}px`, 
                          fontFamily: 'monospace',
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap',
                          flex: 1,
                          minWidth: 0
                        }} title={stock.BENZ}>
                          <strong>{stock.BENZ}</strong>
                        </div>
                        <div style={{ 
                          fontWeight: 'bold', 
                          color: '#ffc107', 
                          fontSize: `${getFontSize(18)}px`, 
                          fontFamily: 'monospace',
                          letterSpacing: '0.5px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }} title={stock.ID}>
                          <strong>{stock.ID}</strong>
                        </div>
                      </div>
                      
                      {/* Row 2: BRAND AND ALTNO */}
                      <div style={{ 
                        fontSize: `${getFontSize(16)}px`, 
                        fontWeight: 'normal',
                        color: 'var(--text-secondary)',
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap',
                        marginBottom: largeFontMode ? '6px' : '4px'
                      }} title={stock.BRAND + ' ' + stock.ALTNO}>
                        {stock.BRAND} {stock.ALTNO}
                      </div>
                      
                      {/* Row 3: DESCRIPTION (left) and QTY (right) */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: largeFontMode ? '6px' : '4px'
                      }}>
                        <div style={{ 
                          fontWeight: 'normal', 
                          color: 'var(--text-secondary)', 
                          fontSize: `${getFontSize(15)}px`, 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap',
                          flex: 1,
                          minWidth: 0
                        }} title={stock.DESCRIPTION || 'No description'}>
                          {stock.DESCRIPTION || 'No description'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-tertiary)', borderRadius: 6, padding: largeFontMode ? '4px 6px' : '2px 4px', border: '1px solid var(--border-color)', flexShrink: 0, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
                          <button
                            style={{
                              background: 'var(--bg-secondary)',
                              color: 'var(--text-primary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '3px',
                              width: largeFontMode ? '32px' : '28px',
                              height: largeFontMode ? '32px' : '28px',
                              fontSize: `${getFontSize(18)}px`,
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              lineHeight: '1',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 0,
                              marginRight: 3,
                              transition: 'all 0.2s ease',
                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                            }}
                            onClick={() => {
                              const newQty = Math.max(0, (parseInt(stock.QUANTITY) || 0) - 1);
                              if (newQty === 0) {
                                setSelectedStocks(prev => prev.filter(s => s.ID !== stock.ID));
                              } else {
                                handleCartQuantityChange(stock.ID, newQty);
                              }
                            }}
                            disabled={stock.QUANTITY <= 0}
                            onMouseEnter={(e) => {
                              e.target.style.background = 'var(--hover-bg)';
                              e.target.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.2)';
                              e.target.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = 'var(--bg-secondary)';
                              e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                              e.target.style.transform = 'translateY(0)';
                            }}
                          >
                            -
                          </button>
                          <span style={{
                            color: 'var(--text-primary)',
                            fontWeight: 'bold',
                            fontSize: `${getFontSize(18)}px`,
                            minWidth: largeFontMode ? '36px' : '30px',
                            textAlign: 'center',
                            display: 'inline-block',
                            fontFamily: 'monospace'
                          }}>{stock.QUANTITY}</span>
                          <button
                            style={{
                              background: 'var(--bg-secondary)',
                              color: 'var(--text-primary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '3px',
                              width: largeFontMode ? '32px' : '28px',
                              height: largeFontMode ? '32px' : '28px',
                              fontSize: `${getFontSize(18)}px`,
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              lineHeight: '1',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 0,
                              marginLeft: 3,
                              transition: 'all 0.2s ease',
                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                            }}
                            onClick={() => handleCartQuantityChange(stock.ID, Math.min(getMaxQuantity(stock.ID), (parseInt(stock.QUANTITY) || 0) + 1))}
                            disabled={stock.QUANTITY >= getMaxQuantity(stock.ID)}
                            onMouseEnter={(e) => {
                              e.target.style.background = 'var(--hover-bg)';
                              e.target.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.2)';
                              e.target.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = 'var(--bg-secondary)';
                              e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                              e.target.style.transform = 'translateY(0)';
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      
                      {/* Row 4: PRICE (left label, right value) */}
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        paddingTop: largeFontMode ? '8px' : '6px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                        gap: '8px',
                        minHeight: largeFontMode ? '40px' : '36px',
                        flexShrink: 0
                      }}>
                        <span style={{ fontWeight: 'normal', fontSize: `${getFontSize(16)}px`, color: 'var(--text-primary)', whiteSpace: 'nowrap', flexShrink: 0 }}>PRICE:</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={editingPriceId === stock.ID 
                            ? (stock._rawPrice !== undefined ? stock._rawPrice : getRawPrice(stock.PRICE))
                            : getFormattedPrice(stock.PRICE)
                          }
                          onFocus={(e) => {
                            handlePriceFocus(stock.ID);
                            e.target.select();
                            e.target.style.boxShadow = '0 0 0 3px rgba(25, 118, 210, 0.2), 0 2px 6px rgba(0, 0, 0, 0.15)';
                          }}
                          onBlur={(e) => {
                            handlePriceBlur(stock.ID, e.target.value);
                            e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                          }}
                          onChange={(e) => handlePriceChange(stock.ID, e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.target.blur();
                            }
                          }}
                          style={{ 
                            flex: 1,
                            minWidth: '100px',
                            maxWidth: '140px',
                            borderRadius: 6, 
                            border: editingPriceId === stock.ID ? '1px solid #1976d2' : '1px solid var(--border-color)', 
                            padding: largeFontMode ? '6px 10px' : '4px 8px', 
                            fontSize: `${getFontSize(18)}px`, 
                            background: 'var(--bg-tertiary)', 
                            color: 'var(--text-primary)', 
                            textAlign: 'right',
                            fontFamily: 'monospace',
                            fontWeight: 'bold',
                            flexShrink: 0,
                            boxShadow: editingPriceId === stock.ID ? '0 0 0 3px rgba(25, 118, 210, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
                            transition: 'all 0.2s ease'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {selectedStocks.length === 0 && <div style={{color:'var(--text-muted)'}}>No items selected.</div>}
              </div>
                 <div className="pos-cart-modal-footer" style={{ 
                   display: 'flex', 
                   justifyContent: 'center', 
                   gap: largeFontMode ? 10 : 8, 
                   padding: largeFontMode ? '16px 12px' : '14px 10px', 
                   flexWrap: 'wrap',
                   overflowX: 'hidden'
                 }}>
                {addToOrderId ? (
                  // "Add to Order" mode - only show Add to Order button
                  <>
                    <button
                      onClick={handleAddToOrder}
                      disabled={selectedStocks.length === 0}
                      style={{ border: '1.5px solid #17a2b8', color: '#fff', background: '#17a2b8', borderRadius: 6, padding: '10px 24px', fontWeight: 600, fontSize: '0.9em', minWidth: 120, transition: 'all 0.2s ease', boxShadow: '0 2px 6px rgba(23, 162, 184, 0.3)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(23, 162, 184, 0.5)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = '0 2px 6px rgba(23, 162, 184, 0.3)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      Add to Order #{addToOrderId}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedStocks([]);
                        setCartOpen(false);
                        navigate('/warehouses');
                      }}
                      style={{ border: '1.5px solid #6c757d', color: '#fff', background: '#6c757d', borderRadius: 6, padding: '10px 24px', fontWeight: 600, fontSize: '0.9em', minWidth: 120, transition: 'all 0.2s ease', boxShadow: '0 2px 6px rgba(108, 117, 125, 0.3)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(108, 117, 125, 0.5)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = '0 2px 6px rgba(108, 117, 125, 0.3)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  // Normal mode - show all buttons
                  <>
                    <button
                      onClick={handleSendToWarehouse}
                      disabled={selectedStocks.length === 0}
                      style={{ 
                        border: '1.5px solid #1976d2', 
                        color: '#fff', 
                        background: '#1976d2', 
                        borderRadius: 6, 
                        padding: largeFontMode ? '14px 28px' : '10px 24px', 
                        fontWeight: 600, 
                        fontSize: `${getFontSize(14)}px`, 
                        minWidth: largeFontMode ? 160 : 120, 
                        transition: 'all 0.2s ease',
                        cursor: selectedStocks.length === 0 ? 'not-allowed' : 'pointer',
                        opacity: selectedStocks.length === 0 ? 0.5 : 1,
                        boxShadow: selectedStocks.length === 0 ? 'none' : '0 2px 6px rgba(25, 118, 210, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedStocks.length > 0) {
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(25, 118, 210, 0.5)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedStocks.length > 0) {
                          e.currentTarget.style.boxShadow = '0 2px 6px rgba(25, 118, 210, 0.3)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }
                      }}
                    >
                      Send to Warehouse
                    </button>
                    <button
                      onClick={handleGenerateQuotation}
                      disabled={selectedStocks.length === 0}
                      style={{ 
                        border: '1.5px solid #28a745', 
                        color: '#fff', 
                        background: '#28a745', 
                        borderRadius: 6, 
                        padding: largeFontMode ? '14px 28px' : '10px 24px', 
                        fontWeight: 600, 
                        fontSize: `${getFontSize(14)}px`, 
                        minWidth: largeFontMode ? 160 : 120, 
                        transition: 'all 0.2s ease',
                        cursor: selectedStocks.length === 0 ? 'not-allowed' : 'pointer',
                        opacity: selectedStocks.length === 0 ? 0.5 : 1,
                        boxShadow: selectedStocks.length === 0 ? 'none' : '0 2px 6px rgba(40, 167, 69, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedStocks.length > 0) {
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(40, 167, 69, 0.5)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedStocks.length > 0) {
                          e.currentTarget.style.boxShadow = '0 2px 6px rgba(40, 167, 69, 0.3)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }
                      }}
                    >
                      Generate Quotation
                    </button>
                    <button
                      onClick={handleHoldOrder}
                      disabled={selectedStocks.length === 0}
                      style={{ 
                        border: '1.5px solid #ff9800', 
                        color: '#fff', 
                        background: '#ff9800', 
                        borderRadius: 6, 
                        padding: largeFontMode ? '14px 28px' : '10px 24px', 
                        fontWeight: 600, 
                        fontSize: `${getFontSize(14)}px`, 
                        minWidth: largeFontMode ? 160 : 120, 
                        transition: 'all 0.2s ease',
                        cursor: selectedStocks.length === 0 ? 'not-allowed' : 'pointer',
                        opacity: selectedStocks.length === 0 ? 0.5 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: selectedStocks.length === 0 ? 'none' : '0 2px 6px rgba(255, 152, 0, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedStocks.length > 0) {
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 152, 0, 0.5)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedStocks.length > 0) {
                          e.currentTarget.style.boxShadow = '0 2px 6px rgba(255, 152, 0, 0.3)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }
                      }}
                    >
                      <Clock size={16} />
                      Hold Order
                    </button>
                    <button
                      onClick={() => {
                        setSelectedStocks([]);
                        setCartOpen(false);
                        setOrderNumber(null);
                        setOrderId(null);
                      }}
                      disabled={selectedStocks.length === 0}
                      style={{ 
                        border: '1.5px solid #dc3545', 
                        color: '#fff', 
                        background: '#dc3545', 
                        borderRadius: 6, 
                        padding: largeFontMode ? '14px 28px' : '10px 24px', 
                        fontWeight: 600, 
                        fontSize: `${getFontSize(14)}px`, 
                        minWidth: largeFontMode ? 160 : 120, 
                        transition: 'background 0.2s, color 0.2s',
                        cursor: selectedStocks.length === 0 ? 'not-allowed' : 'pointer',
                        opacity: selectedStocks.length === 0 ? 0.5 : 1
                      }}
                    >
                      Clear Cart
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Hold Order Modal - Customer Name Input */}
      {showHoldOrderModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 4000
        }}>
          <div style={{
            backgroundColor: 'var(--card-bg)',
            borderRadius: 12,
            padding: 0,
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 8px 32px var(--shadow-lg)',
            border: '1px solid var(--border-color)'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px 16px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--modal-bg)'
            }}>
              <h3 style={{ margin: 0, color: 'var(--cart-title-color)', fontSize: '20px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={20} />
                Hold Order
              </h3>
              <button
                onClick={() => {
                  setShowHoldOrderModal(false);
                  setHoldOrderCustomerName('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--cart-title-color)',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  transition: 'background 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(144, 202, 249, 0.1)'}
                onMouseOut={e => e.currentTarget.style.background = 'none'}
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div style={{
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              <div>
                <label style={{ 
                  display: 'block', 
                  color: 'var(--cart-title-color)', 
                  fontSize: '14px', 
                  fontWeight: 600, 
                  marginBottom: '8px' 
                }}>
                  Customer Name *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={holdOrderCustomerName}
                    onChange={(e) => {
                      setHoldOrderCustomerName(e.target.value);
                      setShowCustomerSuggestions(true);
                    }}
                    onFocus={() => setShowCustomerSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 200)}
                    placeholder="Enter customer name"
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      textTransform: 'uppercase'
                    }}
                  />
                  {showCustomerSuggestions && filteredCustomerSuggestions.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '4px',
                      backgroundColor: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      boxShadow: '0 4px 12px var(--shadow-md)'
                    }}>
                      {filteredCustomerSuggestions.slice(0, 10).map((name, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setHoldOrderCustomerName(name);
                            setShowCustomerSuggestions(false);
                          }}
                          style={{
                            padding: '10px 16px',
                            cursor: 'pointer',
                            color: 'var(--text-primary)',
                            fontSize: '14px',
                            borderBottom: idx < Math.min(filteredCustomerSuggestions.length, 10) - 1 ? '1px solid var(--border-color)' : 'none',
                            transition: 'background 0.2s'
                          }}
                          onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                          onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          {name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{
                padding: '12px',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ color: 'var(--cart-title-color)', fontSize: '13px', marginBottom: '8px' }}>
                  Order Summary
                </div>
                <div style={{ color: '#e0e0e0', fontSize: '14px' }}>
                  {selectedStocks.length} item(s) • Total: ₱{selectedStocks.reduce((sum, item) => sum + ((item.PRICE || 0) * (item.QUANTITY || 1)), 0).toLocaleString()}
                </div>
                {orderNumber && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
                    Order #: {orderNumber}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              background: 'var(--bg-secondary)'
            }}>
              <button
                onClick={() => {
                  setShowHoldOrderModal(false);
                  setHoldOrderCustomerName('');
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmHoldOrder}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: '1px solid #ff9800',
                  backgroundColor: '#ff9800',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#f57c00'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = '#ff9800'}
              >
                <Clock size={16} />
                Hold Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Held Orders Modal - Cart Style */}
      {showHeldOrdersModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 4000
        }}>
          <div style={{
            backgroundColor: 'var(--card-bg)',
            borderRadius: 12,
            padding: 0,
            maxWidth: '900px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 32px var(--shadow-lg)',
            border: '1px solid var(--border-color)'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px 16px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--modal-bg)'
            }}>
              <h3 style={{ margin: 0, color: 'var(--cart-title-color)', fontSize: '20px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bookmark size={20} />
                Held Orders ({heldOrders.length})
              </h3>
              <button
                onClick={() => setShowHeldOrdersModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--cart-title-color)',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  transition: 'background 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(144, 202, 249, 0.1)'}
                onMouseOut={e => e.currentTarget.style.background = 'none'}
              >
                ×
              </button>
            </div>

            {/* Content - Cart Style */}
            <div style={{
              padding: '20px',
              flex: 1,
              overflowY: 'auto',
              background: 'var(--card-bg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              {heldOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--text-muted)' }}>
                  <Clock size={64} style={{ marginBottom: '20px', opacity: 0.5, color: '#9c27b0' }} />
                  <p style={{ fontSize: '18px', color: 'var(--text-muted)', marginBottom: '8px' }}>No held orders</p>
                  <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Hold an order to save it for later</p>
                </div>
              ) : (
                heldOrders.map((heldOrder, index) => {
                  const orderDate = new Date(heldOrder.timestamp);
                  const totalAmount = heldOrder.items.reduce((sum, item) => sum + ((item.PRICE || 0) * (item.QUANTITY || 1)), 0);
                  
                  return (
                    <div key={heldOrder.id} style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      backgroundColor: 'var(--card-bg)',
                      padding: '0',
                      overflow: 'hidden',
                      boxShadow: '0 2px 8px var(--shadow-md)'
                    }}>
                      {/* Cart Header */}
                      <div style={{
                        padding: '16px 20px',
                        background: 'var(--bg-secondary)',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                            <Cart size={18} style={{ color: 'var(--cart-title-color)' }} />
                            <div style={{ color: 'var(--cart-title-color)', fontWeight: 700, fontSize: '16px' }}>
                              {heldOrder.customerName || 'Customer'}
                            </div>
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: '30px' }}>
                            {orderDate.toLocaleString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: 'var(--cart-title-color)', fontWeight: 700, fontSize: '18px' }}>
                            ₱{totalAmount.toLocaleString()}
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                            {heldOrder.items.length} item(s)
                          </div>
                        </div>
                      </div>

                      {/* Order Number */}
                      {heldOrder.orderNumber && (
                        <div style={{
                          padding: '8px 20px',
                          background: 'var(--bg-tertiary)',
                          borderBottom: '1px solid var(--border-color)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span style={{ color: '#666', fontSize: '12px' }}>Order #:</span>
                          <span style={{ color: '#1976d2', fontWeight: 600, fontSize: '13px' }}>
                            {heldOrder.orderNumber}
                          </span>
                        </div>
                      )}

                      {/* Cart Items List */}
                      <div style={{
                        maxHeight: '300px',
                        overflowY: 'auto',
                        background: '#1a1a1a',
                        padding: '12px 20px'
                      }}>
                        {heldOrder.items.map((item, itemIndex) => (
                          <div key={itemIndex} style={{
                            padding: '12px 0',
                            borderBottom: itemIndex < heldOrder.items.length - 1 ? '1px solid #2d2d2d' : 'none',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '16px'
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <span style={{ color: 'var(--cart-title-color)', fontWeight: 600, fontSize: '13px' }}>
                                  ID: {item.ID}
                                </span>
                                {item.BENZ && (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                    {item.BENZ}
                                  </span>
                                )}
                              </div>
                              <div style={{ color: 'var(--text-primary)', fontSize: '13px', marginBottom: '2px' }}>
                                {item.BRAND} {item.ALTNO}
                              </div>
                              {item.DESCRIPTION && (
                                <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                                  {item.DESCRIPTION}
                                </div>
                              )}
                            </div>
                            <div style={{ textAlign: 'right', minWidth: '120px' }}>
                              <div style={{ color: 'var(--text-primary)', fontSize: '13px', marginBottom: '4px' }}>
                                Qty: <span style={{ color: 'var(--cart-title-color)', fontWeight: 600 }}>{item.QUANTITY || 1}</span>
                              </div>
                              <div style={{ color: 'var(--cart-title-color)', fontWeight: 600, fontSize: '14px' }}>
                                ₱{((item.PRICE || 0) * (item.QUANTITY || 1)).toLocaleString()}
                              </div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
                                @ ₱{(item.PRICE || 0).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Cart Footer - Total */}
                      <div style={{
                        padding: '16px 20px',
                        background: '#23272f',
                        borderTop: '1px solid #2d2d2d',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ color: '#e0e0e0', fontSize: '14px', fontWeight: 600 }}>
                          Total Amount:
                        </div>
                        <div style={{ color: 'var(--cart-title-color)', fontSize: '20px', fontWeight: 700 }}>
                          ₱{totalAmount.toLocaleString()}
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{
                        padding: '16px 20px',
                        background: '#181a1b',
                        borderTop: '1px solid #2d2d2d',
                        display: 'flex',
                        gap: '12px',
                        justifyContent: 'flex-end'
                      }}>
                        <button
                          onClick={() => handleRestoreOrder(heldOrder)}
                          style={{
                            padding: '10px 20px',
                            borderRadius: '6px',
                            border: '1px solid #28a745',
                            backgroundColor: '#28a745',
                            color: '#fff',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                          onMouseOver={e => e.currentTarget.style.backgroundColor = '#218838'}
                          onMouseOut={e => e.currentTarget.style.backgroundColor = '#28a745'}
                        >
                          <RefreshCw size={16} />
                          Restore Order
                        </button>
                        <button
                          onClick={() => handleDeleteHeldOrder(heldOrder.id)}
                          style={{
                            padding: '10px 20px',
                            borderRadius: '6px',
                            border: '1px solid #dc3545',
                            backgroundColor: 'transparent',
                            color: '#dc3545',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                          onMouseOver={e => {
                            e.currentTarget.style.backgroundColor = '#dc3545';
                            e.currentTarget.style.color = '#fff';
                          }}
                          onMouseOut={e => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = '#dc3545';
                          }}
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quotation Modal */}
      {quotationModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'var(--modal-overlay)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 4000
        }}>
          <div style={{
            backgroundColor: 'var(--card-bg)',
            borderRadius: 12,
            padding: 0,
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            border: '1px solid var(--border-color)'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px 16px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--bg-secondary)'
            }}>
              <h3 style={{ margin: 0, color: 'var(--cart-title-color)', fontSize: '20px', fontWeight: 600 }}>
                Generate Quotation
              </h3>
              <button
                onClick={() => setQuotationModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--cart-title-color)',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  transition: 'background 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(144, 202, 249, 0.1)'}
                onMouseOut={e => e.currentTarget.style.background = 'none'}
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div style={{
              padding: '24px',
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              {/* Customer Information */}
              <div>
                <h4 style={{ color: 'var(--cart-title-color)', marginBottom: '16px', fontSize: '16px' }}>
                  Customer Information
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      value={quotationForm.customer_name}
                      onChange={e => setQuotationForm(prev => ({ ...prev, customer_name: e.target.value.toUpperCase() }))}
                      placeholder="Enter customer name"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--input-bg)',
                        color: 'var(--text-primary)',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                      Chassis Number
                    </label>
                    <input
                      type="text"
                      value={quotationForm.chassis_number}
                      onChange={e => setQuotationForm(prev => ({ ...prev, chassis_number: e.target.value }))}
                      placeholder="Enter chassis number"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--input-bg)',
                        color: 'var(--text-primary)',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                      Contact Number
                    </label>
                    <input
                      type="text"
                      value={quotationForm.contact_number}
                      onChange={e => setQuotationForm(prev => ({ ...prev, contact_number: e.target.value }))}
                      placeholder="Enter contact number"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--input-bg)',
                        color: 'var(--text-primary)',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Quotation Items */}
              <div>
                <h4 style={{ color: 'var(--cart-title-color)', marginBottom: '16px', fontSize: '16px' }}>
                  Quotation Items ({selectedStocks.length})
                </h4>
                <div style={{
                  maxHeight: '300px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-tertiary)'
                }}>
                  {selectedStocks.map((stock, index) => (
                    <div key={stock.ID} style={{
                      padding: '12px 16px',
                      borderBottom: index < selectedStocks.length - 1 ? '1px solid var(--border-color)' : 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: 'var(--cart-title-color)', fontWeight: 600, fontSize: '14px' }}>
                          ID: {stock.ID}
                        </div>
                        <div style={{ color: 'var(--text-primary)', fontSize: '13px', marginTop: '2px' }}>
                          {stock.BENZ} - {stock.BRAND} {stock.ALTNO}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                          {stock.DESCRIPTION}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: '120px' }}>
                        <div style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
                          Qty: {stock.QUANTITY}
                        </div>
                        <div style={{ color: 'var(--cart-title-color)', fontSize: '14px', fontWeight: 600 }}>
                          ₱{(stock.PRICE * stock.QUANTITY).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div style={{
                padding: '16px',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600 }}>
                    Total Amount:
                  </span>
                  <span style={{ color: 'var(--cart-title-color)', fontSize: '18px', fontWeight: 700 }}>
                    ₱{selectedStocks.reduce((sum, stock) => sum + (stock.PRICE * stock.QUANTITY), 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              background: 'var(--bg-secondary)'
            }}>
              <button
                onClick={() => setQuotationModalOpen(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleQuotationSubmit}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: '1px solid #28a745',
                  backgroundColor: '#28a745',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.backgroundColor = '#218838';
                  e.currentTarget.style.borderColor = '#218838';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.backgroundColor = '#28a745';
                  e.currentTarget.style.borderColor = '#28a745';
                }}
              >
                Generate Quotation
              </button>
                          </div>
            </div>
          </div>
        )}

        {/* Warehouse Modal - Customer Name Required */}
        {warehouseModalOpen && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'var(--modal-overlay)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 4000
          }}>
            <div style={{
              backgroundColor: 'var(--modal-bg)',
              borderRadius: 12,
              padding: 0,
              maxWidth: '700px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 8px 32px var(--shadow-lg)',
              border: '1px solid var(--border-color)'
            }}>
              {/* Header */}
              <div style={{
                padding: '20px 24px 16px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--modal-bg)'
              }}>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '20px', fontWeight: 600 }}>
                  Send to Warehouse
                </h3>
                <button
                  onClick={() => {
                    setWarehouseModalOpen(false);
                    setWarehouseCustomerName('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '24px',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                  onMouseOut={e => e.currentTarget.style.background = 'none'}
                >
                  ×
                </button>
              </div>

              {/* Content */}
              <div style={{
                padding: '24px',
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}>
                {/* Order Information */}
                <div>
                  <h4 style={{ color: 'var(--text-primary)', marginBottom: '16px', fontSize: '16px' }}>
                    Order Information
                  </h4>
                  
                  {/* Customer Name */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '6px', fontSize: '14px', fontWeight: 600 }}>
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      value={warehouseCustomerName}
                      onChange={e => setWarehouseCustomerName(e.target.value.toUpperCase())}
                      placeholder="Enter customer name"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--input-bg)',
                        color: 'var(--text-primary)',
                        fontSize: '14px'
                      }}
                      onKeyPress={e => {
                        if (e.key === 'Enter' && warehouseCustomerName.trim()) {
                          handleConfirmSendToWarehouse();
                        }
                      }}
                    />
                  </div>

                  {/* Date (Read-only) */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '6px', fontSize: '14px', fontWeight: 600 }}>
                      Date
                    </label>
                    <input
                      type="text"
                      value={new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      readOnly
                      disabled
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--input-bg)',
                        color: 'var(--text-muted)',
                        fontSize: '14px',
                        cursor: 'not-allowed'
                      }}
                    />
                  </div>
                </div>

                {/* Order List */}
                <div>
                  <h4 style={{ color: 'var(--text-primary)', marginBottom: '16px', fontSize: '16px' }}>
                    Order Items ({selectedStocks.length})
                  </h4>
                  <div style={{
                    maxHeight: '300px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--card-bg)'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                          <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600 }}>ID</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600 }}>Part Number</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600 }}>Brand</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600 }}>Qty</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600 }}>Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedStocks.map((stock, index) => (
                          <tr key={stock.ID || index} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px' }}>{stock.ID}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px' }}>{stock.BENZ || 'N/A'}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px' }}>{stock.BRAND || 'N/A'}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px', textAlign: 'right' }}>{stock.QUANTITY}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px', textAlign: 'right' }}>₱{parseFloat(stock.PRICE || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Total */}
                <div style={{
                  padding: '16px',
                  backgroundColor: 'var(--card-bg)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600 }}>
                      Order Total:
                    </span>
                    <span style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 700 }}>
                      ₱{selectedStocks.reduce((sum, stock) => sum + (parseFloat(stock.PRICE || 0) * parseInt(stock.QUANTITY || 0)), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                background: 'var(--modal-bg)'
              }}>
                <button
                  onClick={() => {
                    setWarehouseModalOpen(false);
                    setWarehouseCustomerName('');
                  }}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSendToWarehouse}
                  disabled={!warehouseCustomerName || !warehouseCustomerName.trim()}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '6px',
                    border: '1px solid #1976d2',
                    backgroundColor: '#1976d2',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: warehouseCustomerName && warehouseCustomerName.trim() ? 'pointer' : 'not-allowed',
                    opacity: warehouseCustomerName && warehouseCustomerName.trim() ? 1 : 0.5,
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={e => {
                    if (warehouseCustomerName && warehouseCustomerName.trim()) {
                      e.currentTarget.style.backgroundColor = '#1565c0';
                      e.currentTarget.style.borderColor = '#1565c0';
                    }
                  }}
                  onMouseOut={e => {
                    if (warehouseCustomerName && warehouseCustomerName.trim()) {
                      e.currentTarget.style.backgroundColor = '#1976d2';
                      e.currentTarget.style.borderColor = '#1976d2';
                    }
                  }}
                >
                  Send to Warehouse
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notification UI (right side) */}
      {returnedOrderNotification && (
        <div style={{ position: 'fixed', top: 80, right: 32, zIndex: 4000, background: '#1976d2', color: '#fff', borderRadius: 8, boxShadow: '0 2px 8px 0 rgba(25,118,210,0.18)', padding: '18px 28px', cursor: 'pointer', fontWeight: 600, fontSize: 16 }}
          onClick={() => { setReturnedOrderModal(returnedOrderNotification); setReturnedOrderNotification(null); }}>
          Order Returned from Warehouse<br />
          <span style={{ fontWeight: 400, fontSize: 14 }}>Order Number: {returnedOrderNotification.orderId.slice(0,8).toUpperCase()}</span>
        </div>
      )}

      {/* Returned Order Modal */}
      {returnedOrderModal && (
        <div className="pos-modal-overlay" style={{ zIndex: 4100 }} onClick={() => setReturnedOrderModal(null)}>
          <div className="pos-cart-modal" style={{ minWidth: 380, maxWidth: 420, margin: '80px auto', background: 'rgba(35, 39, 47, 0.2)', borderRadius: 12, boxShadow: '0 4px 24px 0 rgba(0,0,0,0.18)', padding: 0, display: 'flex', flexDirection: 'column', maxHeight: '90vh', height: '90vh' }} onClick={e => e.stopPropagation()}>
            <div className="pos-cart-modal-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', background: 'rgba(24, 26, 27, 0.2)', borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: '18px 24px 10px 24px' }}>
              <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 20, color: 'var(--cart-title-color)', letterSpacing: 1 }}>Returned Order</span>
                <button className="pos-cart-modal-close" style={{ fontSize: 22, color: 'var(--cart-title-color)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 12 }} onClick={() => setReturnedOrderModal(null)}>×</button>
              </div>
              <div style={{ marginTop: 8, fontWeight: 600, fontSize: 15, color: '#1976d2', letterSpacing: 1, background: 'var(--bg-tertiary)', padding: '4px 12px', borderRadius: 6 }}>
                Order Number: {returnedOrderModal.orderId.slice(0,8).toUpperCase()}
              </div>
            </div>
            <div className="pos-cart-list" style={{ padding: '18px 24px 0 24px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <div style={{ fontWeight: 600, color: 'var(--cart-title-color)', fontSize: 15, marginBottom: 8 }}>Order Items</div>
              {returnedOrderModal.items.map(stock => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 10 }} key={stock.id}>
                      <button
                        onClick={() => setReturnedOrderModal(modal => ({ ...modal, items: modal.items.filter(s => s.id !== stock.id) }))}
                        style={{
                          background: 'none',
                          border: 'none',
                          borderRadius: '50%',
                          width: 32,
                          height: 32,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#dc3545',
                          cursor: 'pointer',
                          marginRight: 8,
                          transition: 'background 0.15s',
                          flexShrink: 0,
                        }}
                        title="Remove"
                        onMouseOver={e => e.currentTarget.style.background = 'rgba(220,53,69,0.08)'}
                        onMouseOut={e => e.currentTarget.style.background = 'none'}
                      >
                        <Trash2 size={18} />
                      </button>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#181a1b', borderRadius: 8, padding: '10px 12px', minHeight: 56 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, flex: 1, width: 180, maxWidth: 180 }}>
                          <div className="pos-cart-item-desc" style={{ fontWeight: 700, color: 'var(--cart-title-color)', marginBottom: 2, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.id}>ID: {stock.id}</div>
                          <div className="pos-cart-item-desc" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.BENZ}>{stock.BENZ}</div>
                          <div className="pos-cart-item-desc" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.BRAND + ' ' + stock.ALTNO}>{stock.BRAND} {stock.ALTNO}</div>
                          <div className="pos-cart-item-desc" style={{ fontWeight: 400, color: '#fff', fontSize: 13, marginTop: 2, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={stock.DESCRIPTION || 'No description'}>{stock.DESCRIPTION || 'No description'}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, marginLeft: 12, minWidth: 120 }}>
                          <div className="pos-cart-item-desc" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 500 }}>QTY:</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={stock.quantity}
                              onChange={e => setReturnedOrderModal(modal => ({ ...modal, items: modal.items.map(s => s.id === stock.id ? { ...s, quantity: parseInt(e.target.value) || 0 } : s) }))}
                              style={{ width: 48, borderRadius: 8, border: '1px solid var(--border-color)', padding: '2px 6px', fontSize: '1em', background: 'var(--input-bg)', color: 'var(--text-primary)', textAlign: 'right' }}
                            />
                          </div>
                          <div className="pos-cart-item-desc" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 500 }}>Price:</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              value={formatAccountingINR(stock.SELL)}
                              onChange={e => setReturnedOrderModal(modal => ({ ...modal, items: modal.items.map(s => s.id === stock.id ? { ...s, SELL: e.target.value } : s) }))}
                              style={{ width: 70, borderRadius: 8, border: '1px solid var(--border-color)', padding: '2px 6px', fontSize: '1em', background: 'var(--input-bg)', color: 'var(--text-primary)', textAlign: 'right' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              {returnedOrderModal.items.length === 0 && <div style={{color:'var(--text-muted)'}}>No items in this order.</div>}
            </div>
            <div className="pos-cart-modal-footer" style={{ display: 'flex', justifyContent: 'center', gap: 16, padding: '18px 0 18px 0' }}>
              <button
                onClick={() => {
                  // Re-add items to cart modal for editing/processing
                  setSelectedStocks(returnedOrderModal.items.map(s => ({
                    ...s,
                    ID: s.id,
                    QUANTITY: s.quantity,
                    PRICE: s.SELL
                  })));
                  setCartOpen(true);
                  setReturnedOrderModal(null);
                }}
                style={{ border: '1.5px solid #1976d2', color: '#fff', background: '#1976d2', borderRadius: 6, padding: '10px 32px', fontWeight: 600, fontSize: '1em', minWidth: 140, transition: 'background 0.2s, color 0.2s' }}
              >
                Edit & Re-Add to Cart
              </button>
              <button
                onClick={() => setReturnedOrderModal(null)}
                style={{ border: '1.5px solid #dc3545', color: '#fff', background: '#dc3545', borderRadius: 6, padding: '10px 32px', fontWeight: 600, fontSize: '1em', minWidth: 140, transition: 'background 0.2s, color 0.2s' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {barcodeScannerOpen && (
        <div className="pos-modal-overlay" onClick={() => setBarcodeScannerOpen(false)}>
          <div className="pos-modal" onClick={e => e.stopPropagation()}>
            <div className="pos-modal-header">
              <h3>Barcode Scanner</h3>
              <button 
                className="pos-modal-close" 
                onClick={() => setBarcodeScannerOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="pos-modal-body">
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{ marginBottom: '20px' }}>
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#1976d2' }}>
                    <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
                    <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                    <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
                    <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                    <path d="M7 3h10"/>
                    <path d="M7 21h10"/>
                    <path d="M3 7h18"/>
                    <path d="M3 17h18"/>
                  </svg>
                </div>
                <p style={{ marginBottom: '20px', color: '#e0e0e0' }}>
                  Scan a barcode to quickly find the item in inventory
                </p>
                
                {/* Manual Barcode Input */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#e0e0e0', textAlign: 'left' }}>
                    Or manually enter barcode:
                  </label>
                  <input
                    type="text"
                    value={scannedBarcode}
                    onChange={(e) => setScannedBarcode(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleBarcodeScan(e.target.value)}
                    placeholder="Enter barcode number..."
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #2d2d2d',
                      background: '#23272f',
                      color: '#fff',
                      fontSize: '16px'
                    }}
                    autoFocus
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button
                    onClick={() => handleBarcodeScan(scannedBarcode)}
                    disabled={!scannedBarcode.trim()}
                    style={{
                      background: '#1976d2',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '12px 24px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: scannedBarcode.trim() ? 'pointer' : 'not-allowed',
                      opacity: scannedBarcode.trim() ? 1 : 0.5
                    }}
                  >
                    Search Item
                  </button>
                  <button
                    onClick={() => setBarcodeScannerOpen(false)}
                    style={{
                      background: 'transparent',
                      color: '#999',
                      border: '1px solid #2d2d2d',
                      borderRadius: '8px',
                      padding: '12px 24px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Preview Modal */}
      {showExportPreview && (
        <div className="pos-modal-overlay" onClick={() => setShowExportPreview(false)}>
          <div 
            className="pos-modal export-preview-modal" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pos-modal-header">
              <h2>Export Preview - Selected Items</h2>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button 
                  className="pos-modal-btn pos-modal-btn-secondary"
                  onClick={clearAllExportItems}
                  disabled={exportPreviewData.length === 0}
                  style={{ 
                    padding: '8px 16px', 
                    fontSize: '14px',
                    background: exportPreviewData.length === 0 ? '#6c757d' : '#dc3545',
                    borderColor: exportPreviewData.length === 0 ? '#6c757d' : '#dc3545',
                    color: 'white',
                    opacity: exportPreviewData.length === 0 ? 0.6 : 1,
                    cursor: exportPreviewData.length === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Clear All
                </button>
                <button className="pos-modal-close" onClick={() => setShowExportPreview(false)}>×</button>
              </div>
            </div>
            
            <div className="pos-modal-body">
              <div className="export-preview-info">
                <p><strong>Export Type:</strong> Selected Items Only</p>
                <p><strong>Total Items:</strong> {exportPreviewData.length}</p>
                <p><strong>Export Date:</strong> {new Date().toLocaleDateString()}</p>
              </div>
              
              <div className="export-preview-table-container">
                {exportPreviewData.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '40px 20px', 
                    color: '#666',
                    fontStyle: 'italic'
                  }}>
                    No items in export preview.
                    <br />
                    <button 
                      className="pos-modal-btn pos-modal-btn-secondary"
                      onClick={() => setShowExportPreview(false)}
                      style={{ 
                        marginTop: '15px',
                        padding: '8px 16px',
                        fontSize: '14px'
                      }}
                    >
                      Close Modal
                    </button>
                  </div>
                ) : (
                  <table className="export-preview-table">
                    <thead>
                      <tr>
                        <th>BENZ</th>
                        <th>BENZ2</th>
                        <th>BENZ3</th>
                        <th>BRAND</th>
                        <th>ALT NO</th>
                        <th>DESCRIPTION</th>
                        <th>ID</th>
                        <th>ID BARCODE</th>
                        <th className="actions-column">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportPreviewData.map((row, index) => (
                        <tr key={index}>
                          <td>{row['BENZ']}</td>
                          <td>{row['BENZ2']}</td>
                          <td>{row['BENZ3']}</td>
                          <td>{row['BRAND']}</td>
                          <td>{row['ALT NO']}</td>
                          <td>{row['DESCRIPTION']}</td>
                          <td>{row['ID']}</td>
                          <td>{row['ID BARCODE']}</td>
                          <td>
                            <button 
                              className="pos-stock-action-btn delete-btn"
                              onClick={() => removeExportItem(index)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            
            <div className="pos-modal-footer">
              <button 
                className="pos-modal-btn pos-modal-btn-secondary"
                onClick={() => setShowExportPreview(false)}
              >
                Cancel
              </button>
              <button 
                className="pos-modal-btn pos-modal-btn-primary"
                onClick={handleExportToExcel}
                disabled={exportPreviewData.length === 0}
              >
                Export to XLSX
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCSVImport && (
        <div className="pos-modal-overlay" onClick={() => !isImporting && resetCSVImport()}>
          <div className="pos-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pos-modal-header">
              <h2>Import CSV Data</h2>
              <button 
                className="pos-modal-close" 
                onClick={resetCSVImport}
                disabled={isImporting}
              >
                ×
              </button>
            </div>
            
            {/* Import Type Tabs */}
            <div style={{ 
              display: 'flex', 
              borderBottom: '2px solid #e9ecef',
              marginBottom: '20px'
            }}>
              <button
                style={{
                  padding: '12px 24px',
                  border: 'none',
                  background: importType === 'stock' ? '#007bff' : '#f8f9fa',
                  color: importType === 'stock' ? 'white' : '#495057',
                  cursor: 'pointer',
                  borderTopLeftRadius: '8px',
                  borderTopRightRadius: '8px',
                  fontWeight: '600',
                  transition: 'all 0.3s ease'
                }}
                onClick={() => setImportType('stock')}
                disabled={isImporting}
              >
                📦 Stock Data
              </button>
              <button
                style={{
                  padding: '12px 24px',
                  border: 'none',
                  background: importType === 'master' ? '#007bff' : '#f8f9fa',
                  color: importType === 'master' ? 'white' : '#495057',
                  cursor: 'pointer',
                  borderTopLeftRadius: '8px',
                  borderTopRightRadius: '8px',
                  fontWeight: '600',
                  transition: 'all 0.3s ease'
                }}
                onClick={() => setImportType('master')}
                disabled={isImporting}
              >
                🗂️ Master Data
              </button>
            </div>
            
            <div className="pos-modal-body">
              {!isImporting && !importResult ? (
                <>
                  <div style={{ marginBottom: '20px' }}>
                    <p style={{ color: '#666', marginBottom: '15px' }}>
                      <strong>⚠️ WARNING:</strong> This will replace ALL existing {importType === 'stock' ? 'stock' : 'master'} data with the CSV data.
                    </p>
                    <div style={{ 
                      background: '#fff3cd', 
                      border: '1px solid #ffeaa7', 
                      borderRadius: '8px', 
                      padding: '15px',
                      marginBottom: '20px'
                    }}>
                      <h4 style={{ color: '#856404', margin: '0 0 10px 0' }}>What this will do:</h4>
                      <ol style={{ color: '#856404', margin: 0, paddingLeft: '20px' }}>
                        <li>Create a backup of current data</li>
                        <li>Delete all existing {importType === 'stock' ? 'stock' : 'master'} records</li>
                        <li>Import new data from the CSV file</li>
                      </ol>
                    </div>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label htmlFor="csvFile" style={{ display: 'block', marginBottom: '10px', fontWeight: '600' }}>
                      Select CSV File:
                    </label>
                    <input
                      type="file"
                      id="csvFile"
                      accept=".csv"
                      onChange={handleCSVFileSelect}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '2px dashed #ddd',
                        borderRadius: '8px',
                        background: '#f8f9fa'
                      }}
                    />
                    {csvFile && (
                      <p style={{ marginTop: '10px', color: '#28a745', fontWeight: '500' }}>
                        ✅ Selected: {csvFile.name} ({(csvFile.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    )}
                  </div>

                  <div style={{ 
                    background: '#e3f2fd', 
                    border: '1px solid #bbdefb', 
                    borderRadius: '8px', 
                    padding: '15px'
                  }}>
                    <h4 style={{ color: '#1976d2', margin: '0 0 10px 0' }}>Expected CSV Format:</h4>
                    {importType === 'stock' ? (
                      <p style={{ color: '#1976d2', margin: 0, fontSize: '14px' }}>
                        DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, COLORCODE, REMARKS, DATE, COST, SELL, QTY, CURRENCY, FCAMOUNT, CONVERSION, LOCATION
                      </p>
                    ) : (
                      <p style={{ color: '#1976d2', margin: 0, fontSize: '14px' }}>
                        DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, DESC, APPL, UNIT, LOCATION, REORDER, BALANCE
                      </p>
                    )}
                  </div>
                </>
              ) : isImporting ? (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ 
                      width: '60px', 
                      height: '60px', 
                      border: '4px solid #f3f3f3',
                      borderTop: '4px solid #007bff',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto 20px auto'
                    }}></div>
                    <h3 style={{ color: '#007bff', marginBottom: '10px' }}>Importing CSV Data...</h3>
                    <p style={{ color: '#666', marginBottom: '20px' }}>{importStatus}</p>
                  </div>
                  
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ 
                      width: '100%', 
                      background: '#f3f3f3', 
                      borderRadius: '10px', 
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${importProgress}%`,
                        height: '20px',
                        background: 'linear-gradient(90deg, #007bff, #0056b3)',
                        transition: 'width 0.3s ease',
                        borderRadius: '10px'
                      }}></div>
                    </div>
                    <p style={{ marginTop: '10px', color: '#007bff', fontWeight: '600' }}>
                      {importProgress}% Complete
                    </p>
                  </div>
                  
                  {/* Terminal-style progress display */}
                  <div style={{ 
                    background: '#1a1a1a', 
                    color: '#00ff00', 
                    fontFamily: 'monospace',
                    padding: '15px',
                    borderRadius: '8px',
                    textAlign: 'left',
                    fontSize: '12px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    border: '1px solid #333'
                  }}>
                    <div style={{ marginBottom: '10px', color: '#fff' }}>
                      📁 Processing uploaded CSV file...
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      📋 CSV Headers: {importType === 'stock' ? 
                        'DINFLAG, BENZ, BRAND, ALTNO, ALTNO2, COLORCODE, REMARKS, DATE, COST, SELL, QTY, CURRENCY, FCAMOUNT, CONVERSION, LOCATION' : 
                        'DINFLAG, BENZ, BENZ2, BENZ3, BRAND, ALTNO, ALTNO2, DESC, APPL, UNIT, LOCATION, REORDER, BALANCE'}
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      📊 Parsing CSV data...
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      📊 Parsed {csvFile ? Math.floor(csvFile.size / 100) : 0} data rows from CSV
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      🚀 Starting CSV import process...
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      📦 Creating backup table: {importType === 'stock' ? 'tbl_stock_backup_' : 'master_backup_'}{new Date().toISOString().replace(/[:.-]/g, '_').slice(0, 19)}
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      ✅ Backup created with {csvFile ? Math.floor(csvFile.size / 100) : 0} records
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      🗑️ Clearing existing data from {importType === 'stock' ? 'tbl_stock' : 'master'} table...
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      📝 Creating temporary CSV file...
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      📁 Temporary file ready
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      🚀 Starting fast import with optimized batch inserts...
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      📊 Progress: 25% (40921/163685)
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      📊 Progress: 50% (81842/163685)
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      📊 Progress: 75% (122763/163685)
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      📊 Progress: 100% (163685/163685)
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      🧹 Temporary file cleaned up
                    </div>
                    <div style={{ marginBottom: '5px', color: '#00ff00' }}>
                      🎉 CSV import completed successfully!
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  {importResult?.success ? (
                    <>
                      <div style={{ 
                        width: '60px', 
                        height: '60px', 
                        background: '#28a745',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px auto'
                      }}>
                        <span style={{ color: 'white', fontSize: '30px' }}>✓</span>
                      </div>
                      <h3 style={{ color: '#28a745', marginBottom: '15px' }}>Import Successful!</h3>
                      <p style={{ color: '#666', marginBottom: '20px' }}>
                        {importResult.message}
                      </p>
                      <div style={{ 
                        background: '#f8f9fa', 
                        border: '1px solid #dee2e6', 
                        borderRadius: '8px', 
                        padding: '15px',
                        textAlign: 'left'
                      }}>
                        <p style={{ margin: '5px 0', fontWeight: '600' }}>
                          <strong>Records Imported:</strong> {importResult.importedCount}
                        </p>
                        <p style={{ margin: '5px 0', fontWeight: '600' }}>
                          <strong>Backup Table:</strong> {importResult.backupTable}
                        </p>
                        <p style={{ margin: '5px 0', fontWeight: '600' }}>
                          <strong>Previous Records:</strong> {importResult.backupCount}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ 
                        width: '60px', 
                        height: '60px', 
                        background: '#dc3545',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px auto'
                      }}>
                        <span style={{ color: 'white', fontSize: '30px' }}>✗</span>
                      </div>
                      <h3 style={{ color: '#dc3545', marginBottom: '15px' }}>Import Failed</h3>
                      <p style={{ color: '#666', marginBottom: '20px' }}>
                        {importResult?.error || 'An error occurred during import'}
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
            
            <div className="pos-modal-footer">
              {!isImporting && !importResult ? (
                <>
                  <button 
                    className="pos-modal-btn pos-modal-btn-secondary"
                    onClick={resetCSVImport}
                  >
                    Cancel
                  </button>
                  <button 
                    className="pos-modal-btn pos-modal-btn-primary"
                    onClick={handleCSVImport}
                    disabled={!csvFile}
                  >
                    Start Import
                  </button>
                </>
              ) : !isImporting && importResult ? (
                <button 
                  className="pos-modal-btn pos-modal-btn-primary"
                  onClick={resetCSVImport}
                >
                  Close
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scan Result Modal */}
      {showBarcodeResult && (
        <div className="pos-modal-overlay" onClick={() => setShowBarcodeResult(false)}>
          <div className="pos-modal" style={{ maxWidth: '80vw', width: '800px' }} onClick={(e) => e.stopPropagation()}>
            <div className="pos-modal-header">
              <h2>Barcode Scan Result</h2>
              <button className="pos-modal-close" onClick={() => setShowBarcodeResult(false)}>×</button>
            </div>
            
            <div className="pos-modal-body">
              {scannedStockData ? (
                <div style={{ padding: '20px' }}>
                  {/* Quality Score Header */}
                  <div style={{ 
                    background: scannedQualityData?.level === 'Good' ? '#28a745' : 
                               scannedQualityData?.level === 'Medium' ? '#ffc107' : '#28a745',
                    color: 'white', 
                    padding: '15px', 
                    borderRadius: '8px', 
                    marginBottom: '20px',
                    textAlign: 'center'
                  }}>
                    <h3 style={{ margin: 0 }}>✅ Item Found!</h3>
                    <p style={{ margin: '10px 0 0 0', opacity: 0.9 }}>Barcode: {scannedBarcode}</p>
                    {scannedQualityData && (
                      <div style={{ 
                        background: 'rgba(255,255,255,0.2)', 
                        padding: '8px 12px', 
                        borderRadius: '6px',
                        marginTop: '10px',
                        display: 'inline-block'
                      }}>
                        <strong>Data Quality: {scannedQualityData.score}% ({scannedQualityData.level})</strong>
                        {scannedQualityData.missing.length > 0 && (
                          <div style={{ fontSize: '12px', marginTop: '5px', opacity: 0.9 }}>
                            Missing: {scannedQualityData.missing.join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Unified Product Information Section - Terminal Style Layout */}
                  <div style={{ 
                    background: '#ffffff', 
                    border: '2px solid #007bff', 
                    borderRadius: '8px', 
                    padding: '25px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    marginBottom: '20px'
                  }}>
                    <h4 style={{ margin: '0 0 25px 0', color: '#007bff', fontSize: '20px', fontWeight: '600', textAlign: 'center' }}>
                      📦 Complete Product Information
                    </h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      {/* Left Column */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>ID:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedBarcode || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Date:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {(() => {
                              const rawDate = scannedInmainData?.date || scannedStockData.DATE || '';
                              if (!rawDate) return '';
                              
                              // Handle YYYYMMDD format (like "20250827")
                              if (/^\d{8}$/.test(rawDate)) {
                                const year = rawDate.substring(0, 4);
                                const month = rawDate.substring(4, 6);
                                const day = rawDate.substring(6, 8);
                                return `${year}-${month}-${day}`;
                              }
                              
                              // Handle YYYY-MM-DD format
                              if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
                                return rawDate;
                              }
                              
                              // Return as-is for other formats
                              return rawDate;
                            })()}
                          </span>
                        </div>
                        

                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Reference:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.REF || scannedStockData.REFERENCE || scannedInmainData?.reference || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Supplier:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedInmainData?.supplier || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>DIN:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedMasterData?.dinflag || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Benz Number:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.BENZ || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Benz2:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.BENZ2 || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Benz3:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.BENZ3 || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Brand:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.BRAND || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>OEM#:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.ALTNO || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>OEM2#:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.ALTNO2 || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Description:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedMasterData?.description || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Application:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedMasterData?.application || ''}
                          </span>
                        </div>
                        

                      </div>
                      
                      {/* Right Column */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Color Code:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.COLORCODE || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Remarks:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.REMARKS || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Cost:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.COST || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Selling Price:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.SELL || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Currency:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.CURRENCY || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>FC Cost:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.FC_COST || scannedStockData.FCAMOUNT || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Conversion:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.CONVERSION || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Quantity:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.QTY || scannedInmainData?.quantity || ''}
                          </span>
                        </div>
                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Unit:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.UNIT || scannedMasterData?.unit || ''}
                          </span>
                        </div>
                        

                        
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px',
                          border: '1px solid #e9ecef',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <strong style={{ color: '#495057', fontSize: '14px', minWidth: '120px' }}>Location:</strong>
                          <span style={{ color: '#212529', fontSize: '14px', fontWeight: '500' }}>
                            {scannedStockData.LOCATION || ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '40px 20px',
                  color: '#dc3545'
                }}>
                  <div style={{ 
                    width: '80px', 
                    height: '80px', 
                    background: '#dc3545',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 20px auto'
                  }}>
                    <span style={{ color: 'white', fontSize: '40px' }}>✗</span>
                  </div>
                  <h3 style={{ margin: '0 0 15px 0', color: '#dc3545' }}>Item Not Found</h3>
                  <p style={{ margin: '0 0 10px 0', fontSize: '16px' }}>
                    <strong>Barcode:</strong> {scannedBarcode}
                  </p>
                  <p style={{ margin: '0', fontSize: '14px', opacity: 0.8 }}>
                    This barcode doesn't exist in the system or may be tampered.
                  </p>
                  <p style={{ margin: '10px 0 0 0', fontSize: '14px', opacity: 0.8 }}>
                    Please check the barcode or contact administrator.
                  </p>
                </div>
              )}
            </div>
            
          </div>
        </div>
      )}


      {/* Clear Confirmation Modal */}
      {showClearConfirmation && clearConfirmationData && (
        <div className="pos-modal-overlay" onClick={() => !refreshLoading && setShowClearConfirmation(false)}>
          <div className="pos-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pos-modal-header">
              <h2>🗑️ Database Cleared Successfully</h2>
            </div>
            
            <div className="pos-modal-body">
              <div style={{ 
                background: '#d4edda', 
                border: '1px solid #c3e6cb', 
                borderRadius: '4px', 
                padding: '20px', 
                marginBottom: '20px',
                color: '#155724'
              }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#155724' }}>✅ Database Cleared</h3>
                <p style={{ margin: '0', fontSize: '14px' }}>
                  Successfully cleared <strong>{clearConfirmationData.clearedRecords}</strong> records from tbl_stock.
                </p>
                <p style={{ margin: '10px 0 0 0', fontSize: '14px' }}>
                  Backup created: <code style={{ background: '#f8f9fa', padding: '2px 4px', borderRadius: '3px' }}>{clearConfirmationData.backupTable}</code>
                </p>
              </div>

              <div style={{ 
                background: '#fff3cd', 
                border: '1px solid #ffeaa7', 
                borderRadius: '4px', 
                padding: '15px', 
                marginBottom: '20px',
                color: '#856404'
              }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#856404' }}>⚠️ What would you like to do?</h4>
                <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '14px' }}>
                  <li><strong>Continue:</strong> Import new data from the DBF file</li>
                  <li><strong>Revert:</strong> Restore the backup and cancel the import</li>
                </ul>
              </div>

              {refreshLoading && (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <div style={{ 
                    display: 'inline-block',
                    width: '20px',
                    height: '20px',
                    border: '2px solid #f3f3f3',
                    borderTop: '2px solid #007bff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    marginRight: '10px'
                  }}></div>
                  Processing...
                </div>
              )}
            </div>
            
            <div className="pos-modal-footer">
              <button 
                className="pos-modal-btn pos-modal-btn-secondary"
                onClick={() => setShowClearConfirmation(false)}
                disabled={refreshLoading}
              >
                Cancel
              </button>
              <button 
                className="pos-modal-btn pos-modal-btn-secondary"
                onClick={handleRevertToBackup}
                disabled={refreshLoading}
                style={{ background: '#dc3545', marginRight: '10px' }}
              >
                🔄 Revert to Backup
              </button>
              <button 
                className="pos-modal-btn pos-modal-btn-primary"
                onClick={handleContinueImport}
                disabled={refreshLoading}
                style={{ background: '#28a745' }}
              >
                ➡️ Continue Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compatibility Search Loading Modal */}
      {compatibilityLoading && (
        <div 
          className="pos-modal-overlay" 
          onClick={() => setCompatibilityLoading(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'var(--modal-overlay)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <div 
            className="pos-modal" 
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--card-bg)',
              padding: '40px',
              borderRadius: '12px',
              textAlign: 'center',
              minWidth: '300px',
              border: '2px solid var(--border-color)',
              cursor: 'default',
              boxShadow: '0 8px 32px var(--shadow-lg)'
            }}
          >
            <div style={{ marginBottom: '20px' }}>
              <RefreshCw 
                className="w-12 h-12 animate-spin" 
                style={{ color: '#007bff', margin: '0 auto' }}
              />
            </div>
            <h3 style={{ 
              color: 'var(--text-primary)', 
              margin: '0 0 10px 0', 
              fontSize: '1.2em',
              fontWeight: '600'
            }}>
              Finding Compatible Parts
            </h3>
            <p style={{ 
              color: 'var(--text-muted)', 
              margin: '0 0 20px 0', 
              fontSize: '0.9em' 
            }}>
              Searching through compatibility chains...
            </p>
            <div style={{
              background: 'var(--bg-tertiary)',
              borderRadius: '8px',
              padding: '10px',
              marginBottom: '20px',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{
                background: '#007bff',
                height: '4px',
                borderRadius: '2px',
                width: '100%',
                animation: 'pulse 1.5s ease-in-out infinite'
              }}></div>
            </div>
            <button
              onClick={() => setCompatibilityLoading(false)}
              className="pos-stock-action-btn"
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9em',
                transition: 'all 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
            >
              Cancel Search
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>

      {/* Navigation Warning Modal */}
      {showNavigationWarning && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'var(--modal-overlay)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            background: 'var(--card-bg)',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
            border: '1px solid var(--border-color)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
          }}>
            <h3 style={{
              color: 'var(--text-primary)',
              margin: '0 0 16px 0',
              fontSize: '1.2em',
              fontWeight: '600'
            }}>
              Unsaved Cart Items
            </h3>
            <p style={{
              color: 'var(--text-primary)',
              margin: '0 0 24px 0',
              lineHeight: '1.5'
            }}>
              You have {selectedStocks.length} item(s) in your cart. Navigating away will clear your cart and lose all unsaved changes.
            </p>
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={cancelNavigation}
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = 'var(--hover-bg)';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = 'var(--bg-tertiary)';
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmNavigation}
                style={{
                  background: '#dc3545',
                  border: '1px solid #dc3545',
                  color: '#ffffff',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = '#c82333';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = '#dc3545';
                }}
              >
                Continue & Clear Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formal Notification Modal */}
      {showNotificationModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'var(--modal-overlay)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 5000
        }}>
          <div style={{
            background: 'var(--modal-bg)',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            border: '1px solid var(--border-color)',
            boxShadow: '0 8px 32px var(--shadow-lg)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                background: notificationData.type === 'success' ? '#28a745' : 
                           notificationData.type === 'error' ? '#dc3545' :
                           notificationData.type === 'warning' ? '#ffc107' : '#007bff'
              }}>
                {notificationData.type === 'success' ? '✓' : 
                 notificationData.type === 'error' ? '✕' :
                 notificationData.type === 'warning' ? '⚠' : 'ℹ'}
              </div>
              <h3 style={{
                color: 'var(--text-primary)',
                margin: 0,
                fontSize: '20px',
                fontWeight: '600'
              }}>
                {notificationData.title}
              </h3>
            </div>

            {/* Modal Body */}
            <div style={{
              color: 'var(--text-secondary)',
              fontSize: '16px',
              lineHeight: '1.5',
              marginBottom: '24px',
              whiteSpace: 'pre-line'
            }}>
              {notificationData.message}
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              {notificationData.showCancel && (
                <button
                  onClick={handleNotificationCancel}
                  style={{
                    background: '#6c757d',
                    color: '#fff',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'background 0.2s ease'
                  }}
                  onMouseOver={(e) => e.target.style.background = '#5a6268'}
                  onMouseOut={(e) => e.target.style.background = '#6c757d'}
                >
                  {notificationData.cancelText}
                </button>
              )}
              <button
                onClick={handleNotificationConfirm}
                style={{
                  background: notificationData.type === 'success' ? '#28a745' : 
                             notificationData.type === 'error' ? '#dc3545' :
                             notificationData.type === 'warning' ? '#ffc107' : '#007bff',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease'
                }}
                onMouseOver={(e) => {
                  const colors = {
                    success: '#218838',
                    error: '#c82333', 
                    warning: '#e0a800',
                    info: '#0056b3'
                  };
                  e.target.style.background = colors[notificationData.type] || '#0056b3';
                }}
                onMouseOut={(e) => {
                  const colors = {
                    success: '#28a745',
                    error: '#dc3545',
                    warning: '#ffc107', 
                    info: '#007bff'
                  };
                  e.target.style.background = colors[notificationData.type] || '#007bff';
                }}
              >
                {notificationData.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Movement History Modal */}
      {showMovementModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: window.innerWidth <= 768 ? '0' : 'clamp(10px, 2vw, 20px)'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowMovementModal(false);
            }
          }}
        >
          <div 
            style={{
              background: '#1a1a1a',
              borderRadius: window.innerWidth <= 768 ? '0' : '12px',
              width: window.innerWidth <= 768 ? '100%' : '95%',
              maxWidth: window.innerWidth <= 768 ? '100%' : '1400px',
              maxHeight: window.innerWidth <= 768 ? '100vh' : '95vh',
              height: window.innerWidth <= 768 ? '100vh' : '95vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              border: '1px solid #404040'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: 'clamp(12px, 2vw, 20px)',
              borderBottom: '2px solid #404040',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              background: '#2d2d2d',
              flexShrink: 0
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ margin: 0, color: '#fff', fontSize: 'clamp(16px, 2.5vw, 20px)', fontWeight: '700', marginBottom: 'clamp(8px, 1.5vw, 12px)' }}>
                  Item Movement History
                </h2>
                <div style={{ marginTop: '8px', color: '#90caf9', fontSize: 'clamp(12px, 1.5vw, 14px)', lineHeight: '1.8' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(8px, 1.5vw, 12px)', marginBottom: '8px' }}>
                    <span><span style={{ fontWeight: '600' }}>Benz:</span> {movementBenz}</span>
                    <span style={{ color: '#4caf50', fontWeight: '600' }}>
                      <span style={{ fontWeight: '600', color: '#90caf9' }}>Total Quantity:</span> <strong>{overallQuantity.toLocaleString()}</strong>
                    </span>
                  </div>
                  {movementDescription && (
                    <div style={{ marginTop: '8px', color: '#e0e0e0', fontSize: 'clamp(11px, 1.3vw, 13px)' }}>
                      <span style={{ fontWeight: '600', color: '#90caf9' }}>Description:</span> <span style={{ marginLeft: '8px' }}>{movementDescription}</span>
                    </div>
                  )}
                  {movementApplication && (
                    <div style={{ marginTop: '4px', color: '#e0e0e0', fontSize: 'clamp(11px, 1.3vw, 13px)' }}>
                      <span style={{ fontWeight: '600', color: '#90caf9' }}>Application:</span> <span style={{ marginLeft: '8px' }}>{movementApplication}</span>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px, 1.5vw, 12px)' }}>
                <button
                  onClick={() => setShowMovementModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontSize: 'clamp(20px, 3vw, 24px)',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    transition: 'background 0.2s',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#404040'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Filter Section */}
            {!movementLoading && movementData.length > 0 && (
              <div style={{
                padding: 'clamp(12px, 2vw, 16px) clamp(12px, 2.5vw, 20px)',
                borderBottom: '2px solid #404040',
                background: '#252525',
                display: 'flex',
                gap: 'clamp(8px, 1.5vw, 16px)',
                alignItems: 'center',
                flexWrap: 'wrap',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(4px, 1vw, 8px)', flexWrap: 'wrap' }}>
                  <label style={{ color: '#90caf9', fontSize: 'clamp(12px, 1.5vw, 14px)', fontWeight: '500', whiteSpace: 'nowrap' }}>
                    Filter by Year:
                  </label>
                  <select
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                    style={{
                      padding: 'clamp(6px, 1vw, 8px) clamp(8px, 1.5vw, 12px)',
                      background: '#2d2d2d',
                      color: '#fff',
                      border: '1px solid #404040',
                      borderRadius: '6px',
                      fontSize: 'clamp(12px, 1.5vw, 14px)',
                      cursor: 'pointer',
                      minWidth: 'clamp(100px, 15vw, 120px)'
                    }}
                  >
                    <option value="">All Years</option>
                    {availableYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(4px, 1vw, 8px)', flexWrap: 'wrap' }}>
                  <label style={{ color: '#90caf9', fontSize: 'clamp(12px, 1.5vw, 14px)', fontWeight: '500', whiteSpace: 'nowrap' }}>
                    Last X Months:
                  </label>
                  <select
                    value={filterMonths}
                    onChange={(e) => setFilterMonths(e.target.value)}
                    style={{
                      padding: 'clamp(6px, 1vw, 8px) clamp(8px, 1.5vw, 12px)',
                      background: '#2d2d2d',
                      color: '#fff',
                      border: '1px solid #404040',
                      borderRadius: '6px',
                      fontSize: 'clamp(12px, 1.5vw, 14px)',
                      cursor: 'pointer',
                      minWidth: 'clamp(100px, 15vw, 120px)'
                    }}
                  >
                    <option value="">All Time</option>
                    <option value="2">Last 2 Months</option>
                    <option value="3">Last 3 Months</option>
                    <option value="6">Last 6 Months</option>
                    <option value="12">Last 12 Months</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(4px, 1vw, 8px)', flexWrap: 'wrap' }}>
                  <label style={{ color: '#90caf9', fontSize: 'clamp(12px, 1.5vw, 14px)', fontWeight: '500', whiteSpace: 'nowrap' }}>
                    Filter by Brand:
                  </label>
                  <select
                    value={filterBrand}
                    onChange={(e) => setFilterBrand(e.target.value)}
                    style={{
                      padding: 'clamp(6px, 1vw, 8px) clamp(8px, 1.5vw, 12px)',
                      background: '#2d2d2d',
                      color: '#fff',
                      border: '1px solid #404040',
                      borderRadius: '6px',
                      fontSize: 'clamp(12px, 1.5vw, 14px)',
                      cursor: 'pointer',
                      minWidth: 'clamp(100px, 15vw, 120px)'
                    }}
                  >
                    <option value="">All Brands</option>
                    {availableBrands.map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginLeft: 'auto', color: '#90caf9', fontSize: 'clamp(12px, 1.5vw, 14px)', whiteSpace: 'nowrap' }}>
                  Showing: <strong>{filteredMovementData.length}</strong> of <strong>{movementData.length}</strong> records
                </div>
              </div>
            )}

            {/* Modal Body */}
            <div style={{
              padding: 'clamp(12px, 2vw, 20px)',
              flex: 1,
              display: 'block',
              overflow: 'hidden',
              minHeight: 0
            }}>
              {movementLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#90caf9' }}>
                  <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }} />
                  <p style={{ marginTop: '16px', fontSize: '16px' }}>Loading movement history...</p>
                </div>
              ) : movementData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                  <p style={{ fontSize: '16px' }}>No movement history found for this part number.</p>
                </div>
              ) : (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  minHeight: 0,
                  height: '100%'
                }}>
                  <div style={{ marginBottom: 'clamp(12px, 1.5vw, 16px)', color: '#90caf9', fontSize: 'clamp(12px, 1.5vw, 14px)', flexShrink: 0 }}>
                    Total Records: <strong>{movementData.length}</strong>
                    {filteredMovementData.length !== movementData.length && (
                      <span style={{ marginLeft: '12px', color: '#ffc107' }}>
                        (Filtered: {filteredMovementData.length})
                      </span>
                    )}
                  </div>
                  <div style={{ 
                    overflowX: 'auto',
                    overflowY: 'auto',
                    flex: 1,
                    border: '1px solid #404040',
                    borderRadius: '8px',
                    minHeight: 0
                  }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      background: '#1a1a1a',
                      color: '#e0e0e0'
                    }}>
                      <thead>
                        <tr style={{ background: '#2d2d2d', position: 'sticky', top: 0, zIndex: 10 }}>
                          <th style={{ 
                            padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', 
                            textAlign: 'left', 
                            borderBottom: '2px solid #404040',
                            color: '#fff',
                            fontWeight: '600',
                            fontSize: 'clamp(11px, 1.3vw, 13px)',
                            textTransform: 'uppercase'
                          }}>Date</th>
                          <th style={{ 
                            padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', 
                            textAlign: 'left', 
                            borderBottom: '2px solid #404040',
                            color: '#fff',
                            fontWeight: '600',
                            fontSize: 'clamp(11px, 1.3vw, 13px)',
                            textTransform: 'uppercase'
                          }}>Customer</th>
                          <th style={{ 
                            padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', 
                            textAlign: 'left', 
                            borderBottom: '2px solid #404040',
                            color: '#fff',
                            fontWeight: '600',
                            fontSize: 'clamp(11px, 1.3vw, 13px)',
                            textTransform: 'uppercase'
                          }}>Brand</th>
                          <th style={{ 
                            padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', 
                            textAlign: 'center', 
                            borderBottom: '2px solid #404040',
                            color: '#fff',
                            fontWeight: '600',
                            fontSize: 'clamp(11px, 1.3vw, 13px)',
                            textTransform: 'uppercase'
                          }}>Quantity</th>
                          <th style={{ 
                            padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', 
                            textAlign: 'right', 
                            borderBottom: '2px solid #404040',
                            color: '#fff',
                            fontWeight: '600',
                            fontSize: 'clamp(11px, 1.3vw, 13px)',
                            textTransform: 'uppercase'
                          }}>Price</th>
                          <th style={{ 
                            padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', 
                            textAlign: 'center', 
                            borderBottom: '2px solid #404040',
                            color: '#fff',
                            fontWeight: '600',
                            fontSize: 'clamp(11px, 1.3vw, 13px)',
                            textTransform: 'uppercase'
                          }}>ID</th>
                          <th style={{ 
                            padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', 
                            textAlign: 'left', 
                            borderBottom: '2px solid #404040',
                            color: '#fff',
                            fontWeight: '600',
                            fontSize: 'clamp(11px, 1.3vw, 13px)',
                            textTransform: 'uppercase'
                          }}>Receipt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMovementData.map((record, index) => (
                          <tr 
                            key={index}
                            style={{
                              borderBottom: '1px solid #333',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.parentElement.style.background = '#2a2a2a'}
                            onMouseLeave={(e) => e.target.parentElement.style.background = 'transparent'}
                          >
                            <td style={{ padding: 'clamp(8px, 1.5vw, 10px) clamp(10px, 2vw, 16px)', fontSize: 'clamp(11px, 1.3vw, 13px)' }}>
                              {record.DATE ? new Date(record.DATE).toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: '2-digit', 
                                day: '2-digit' 
                              }) : 'N/A'}
                            </td>
                            <td style={{ padding: 'clamp(8px, 1.5vw, 10px) clamp(10px, 2vw, 16px)', fontSize: 'clamp(11px, 1.3vw, 13px)' }}>
                              {record.CUSTOMER || 'Walk-in Customer'}
                            </td>
                            <td style={{ padding: 'clamp(8px, 1.5vw, 10px) clamp(10px, 2vw, 16px)', fontSize: 'clamp(11px, 1.3vw, 13px)' }}>
                              {record.BRAND || 'N/A'}
                            </td>
                            <td style={{ padding: 'clamp(8px, 1.5vw, 10px) clamp(10px, 2vw, 16px)', fontSize: 'clamp(11px, 1.3vw, 13px)', textAlign: 'center' }}>
                              {record.quantity || record.QTY || 0}
                            </td>
                            <td style={{ padding: 'clamp(8px, 1.5vw, 10px) clamp(10px, 2vw, 16px)', fontSize: 'clamp(11px, 1.3vw, 13px)', textAlign: 'right' }}>
                              ₱{parseFloat(record.price || record.SELL || 0).toLocaleString('en-US', { 
                                minimumFractionDigits: 2, 
                                maximumFractionDigits: 2 
                              })}
                            </td>
                            <td style={{ padding: 'clamp(8px, 1.5vw, 10px) clamp(10px, 2vw, 16px)', fontSize: 'clamp(11px, 1.3vw, 13px)', textAlign: 'center', color: '#90caf9' }}>
                              {record.id || record.IDCODE || 'N/A'}
                            </td>
                            <td style={{ padding: 'clamp(8px, 1.5vw, 10px) clamp(10px, 2vw, 16px)', fontSize: 'clamp(11px, 1.3vw, 13px)' }}>
                              {record.RECEIPT || record.INVOICE || 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: 'clamp(12px, 2vw, 16px) clamp(12px, 2.5vw, 20px)',
              borderTop: '2px solid #404040',
              display: 'flex',
              justifyContent: 'flex-end',
              background: '#2d2d2d',
              flexShrink: 0
            }}>
              <button
                onClick={() => setShowMovementModal(false)}
                style={{
                  padding: 'clamp(8px, 1.5vw, 10px) clamp(16px, 3vw, 24px)',
                  background: '#007bff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: 'clamp(12px, 1.5vw, 14px)',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = '#0056b3'}
                onMouseLeave={(e) => e.target.style.background = '#007bff'}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Modal */}
      <CustomModal
        show={modalState.show}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
        onConfirm={modalState.onConfirm}
        onCancel={modalState.onCancel || closeModal}
      />
    </div>
  );
};

export default Stock; 