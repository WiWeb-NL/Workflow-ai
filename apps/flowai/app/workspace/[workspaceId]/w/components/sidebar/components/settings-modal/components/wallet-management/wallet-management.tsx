"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Wallet,
  Download,
  Upload,
  RefreshCw,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createLogger } from "@/lib/logs/console-logger";

const logger = createLogger("Wallet-Management");

interface WalletManagementProps {
  onWalletChange?: () => void;
}

interface WalletInfo {
  address: string;
  hasPrivateKey: boolean;
  solBalance?: number;
  flowaiTokenBalance?: number;
}

export function WalletManagement({ onWalletChange }: WalletManagementProps) {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [importPrivateKey, setImportPrivateKey] = useState("");
  const [exportedPrivateKey, setExportedPrivateKey] = useState("");
  const [exportFormat, setExportFormat] = useState<
    "base64" | "array" | "hex" | "comma"
  >("array");
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadWalletInfo = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/tokens/flowai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_wallet" }),
      });

      if (response.ok) {
        const data = await response.json();
        setWallet(data.wallet);
      } else if (response.status === 404) {
        setWallet(null);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to load wallet");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load wallet";
      setError(errorMessage);
      logger.error("Error loading wallet:", err);
      setWallet(null);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const refreshWallet = useCallback(async () => {
    setIsRefreshing(true);
    await loadWalletInfo();
    onWalletChange?.();
  }, [loadWalletInfo, onWalletChange]);

  useEffect(() => {
    loadWalletInfo();
  }, [loadWalletInfo]);

  const handleCreateWallet = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);

      const response = await fetch("/api/tokens/flowai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_wallet" }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create wallet");
      }

      await loadWalletInfo();
      setShowCreateDialog(false);
      onWalletChange?.();

      logger.info("Wallet created successfully");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create wallet";
      setError(errorMessage);
      logger.error("Error creating wallet:", err);
    } finally {
      setIsLoading(false);
    }
  }, [loadWalletInfo, onWalletChange]);

  const handleImportWallet = useCallback(async () => {
    if (!importPrivateKey.trim()) {
      setError("Please enter a private key");
      return;
    }

    try {
      setError(null);
      setIsLoading(true);

      const response = await fetch("/api/tokens/flowai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import_wallet",
          privateKey: importPrivateKey.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to import wallet");
      }

      await loadWalletInfo();
      setShowImportDialog(false);
      setImportPrivateKey("");
      onWalletChange?.();

      logger.info("Wallet imported successfully");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to import wallet";
      setError(errorMessage);
      logger.error("Error importing wallet:", err);
    } finally {
      setIsLoading(false);
    }
  }, [importPrivateKey, loadWalletInfo, onWalletChange]);

  const handleExportPrivateKey = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/tokens/flowai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "export_private_key",
          format: exportFormat,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to export private key");
      }

      setExportedPrivateKey(data.privateKey);
      setShowExportDialog(true);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to export private key";
      setError(errorMessage);
      logger.error("Error exporting private key:", err);
    }
  }, [exportFormat]);

  const handleDeleteWallet = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);

      const response = await fetch("/api/tokens/flowai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_wallet" }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete wallet");
      }

      await loadWalletInfo();
      setShowDeleteConfirm(false);
      onWalletChange?.();

      logger.info("Wallet deleted successfully");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete wallet";
      setError(errorMessage);
      logger.error("Error deleting wallet:", err);
    } finally {
      setIsLoading(false);
    }
  }, [loadWalletInfo, onWalletChange]);

  const copyToClipboard = useCallback(
    async (text: string, description: string) => {
      try {
        await navigator.clipboard.writeText(text);
        // You could add a toast notification here
        logger.info(`${description} copied to clipboard`);
      } catch (err) {
        logger.error(`Failed to copy ${description}:`, err);
      }
    },
    []
  );

  if (isLoading && !isRefreshing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Solana Wallet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Wallet Status Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Solana Wallet
          </CardTitle>
          {wallet && (
            <Button
              variant="outline"
              size="sm"
              onClick={refreshWallet}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`h-3 w-3 mr-1 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!wallet ? (
            <div className="text-center py-8">
              <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No Wallet Found</h3>
              <p className="text-muted-foreground mb-4">
                Create or import a Solana wallet to purchase Credits
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Wallet
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowImportDialog(true)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import Wallet
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Wallet Address */}
              <div>
                <Label className="text-sm font-medium">Wallet Address</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={wallet.address}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(wallet.address, "Wallet address")
                    }
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Balances */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">SOL Balance</Label>
                  <div className="text-lg font-semibold">
                    {wallet.solBalance?.toFixed(4) ?? "0.0000"} SOL
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">FlowAI Tokens</Label>
                  <div className="text-lg font-semibold">
                    {(wallet.flowaiTokenBalance ?? 0).toLocaleString()} FLOWAI
                  </div>
                </div>
              </div>

              {/* Wallet Status */}
              <div className="flex items-center gap-2">
                <Badge
                  variant={wallet.hasPrivateKey ? "default" : "destructive"}
                >
                  {wallet.hasPrivateKey ? "Full Access" : "View Only"}
                </Badge>
                {!wallet.hasPrivateKey && (
                  <span className="text-sm text-muted-foreground">
                    Import private key for transactions
                  </span>
                )}
              </div>

              <Separator />

              {/* Wallet Actions */}
              <div className="flex gap-2 flex-wrap">
                {wallet.hasPrivateKey && (
                  <Button variant="outline" onClick={handleExportPrivateKey}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Private Key
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setShowImportDialog(true)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import New Wallet
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Wallet
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Wallet Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Wallet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                A new Solana wallet will be created for you. Make sure to backup
                your private key after creation.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateWallet} disabled={isLoading}>
              Create Wallet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Wallet Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Wallet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Import your existing wallet using your private key. Supports
                multiple formats: Base64, JSON Array (Solflare/Phantom format),
                comma-separated numbers, or hex. Your private key will be
                encrypted and stored securely.
              </AlertDescription>
            </Alert>
            <div>
              <Label htmlFor="privateKey">Private Key</Label>
              <Textarea
                id="privateKey"
                placeholder="Enter your private key (Base64, JSON array, hex, or comma-separated)..."
                value={importPrivateKey}
                onChange={(e) => setImportPrivateKey(e.target.value)}
                className="font-mono"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowImportDialog(false);
                setImportPrivateKey("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleImportWallet} disabled={isLoading}>
              Import Wallet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Private Key Dialog */}
      <Dialog
        open={showExportDialog}
        onOpenChange={(open) => {
          setShowExportDialog(open);
          if (!open) {
            setExportedPrivateKey("");
            setShowPrivateKey(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Private Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Keep your private key safe and never share it with anyone.
                Anyone with your private key can access your wallet and funds.
              </AlertDescription>
            </Alert>
            <div>
              <Label htmlFor="exportFormat">Export Format</Label>
              <Select
                value={exportFormat}
                onValueChange={(value: "base64" | "array" | "hex" | "comma") =>
                  setExportFormat(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="array">
                    JSON Array (Solflare/Phantom compatible)
                  </SelectItem>
                  <SelectItem value="base64">Base64 (Legacy format)</SelectItem>
                  <SelectItem value="hex">Hex String</SelectItem>
                  <SelectItem value="comma">Comma-separated numbers</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {exportFormat === "array" &&
                  "Recommended for importing into Solflare or Phantom wallet"}
                {exportFormat === "base64" &&
                  "Legacy Base64 format (88 characters)"}
                {exportFormat === "hex" &&
                  "Hexadecimal string format (128 characters)"}
                {exportFormat === "comma" && "Comma-separated decimal numbers"}
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="exportedKey">Private Key</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPrivateKey}
                  disabled={!wallet}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Generate
                </Button>
              </div>
              <div className="flex flex-col gap-2 mt-1">
                <Textarea
                  id="exportedKey"
                  value={
                    showPrivateKey
                      ? exportedPrivateKey
                      : "••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••"
                  }
                  readOnly
                  className="font-mono text-sm"
                  rows={exportFormat === "array" ? 4 : 2}
                />
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                  >
                    {showPrivateKey ? (
                      <EyeOff className="h-4 w-4 mr-1" />
                    ) : (
                      <Eye className="h-4 w-4 mr-1" />
                    )}
                    {showPrivateKey ? "Hide" : "Show"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(exportedPrivateKey, "Private key")
                    }
                    disabled={!exportedPrivateKey}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowExportDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Wallet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This will permanently delete your wallet from our system. Make
                sure you have backed up your private key if you want to recover
                this wallet later. This action cannot be undone.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteWallet}
              disabled={isLoading}
            >
              Delete Wallet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
