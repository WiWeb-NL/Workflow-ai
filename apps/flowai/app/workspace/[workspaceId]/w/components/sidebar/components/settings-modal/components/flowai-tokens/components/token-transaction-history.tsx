"use client";

import { useState } from "react";
import { ExternalLink, Calendar, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Transaction {
  id: string;
  type: "charge" | "refund" | "purchase" | "admin_grant";
  amount: number;
  description: string;
  createdAt: string;
  transactionSignature?: string;
}

interface TokenTransactionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
}

const TRANSACTION_TYPE_LABELS = {
  charge: "Workflow Execution",
  refund: "Refund",
  purchase: "Purchase",
  admin_grant: "Admin Grant",
};

const TRANSACTION_TYPE_COLORS = {
  charge: "destructive" as const,
  refund: "default" as const,
  purchase: "default" as const,
  admin_grant: "secondary" as const,
};

export function TokenTransactionHistory({
  isOpen,
  onClose,
  transactions,
}: TokenTransactionHistoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Filter and sort transactions
  const filteredAndSortedTransactions = transactions
    .filter((tx) => {
      const matchesSearch =
        tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || tx.type === filterType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTransactionIcon = (type: Transaction["type"]) => {
    switch (type) {
      case "charge":
        return "−";
      case "refund":
      case "purchase":
      case "admin_grant":
        return "+";
      default:
        return "·";
    }
  };

  const openSolanaExplorer = (signature: string) => {
    const url = `https://explorer.solana.com/tx/${signature}?cluster=mainnet-beta`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const totalSpent = transactions
    .filter((tx) => tx.type === "charge")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalReceived = transactions
    .filter((tx) => tx.type !== "charge")
    .reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Token Transaction History</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{transactions.length}</div>
                <div className="text-sm text-muted-foreground">
                  Total Transactions
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-red-500">
                  -{totalSpent.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">
                  Tokens Spent
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-500">
                  +{totalReceived.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">
                  Tokens Received
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Search */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="filter-type">Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="charge">Executions</SelectItem>
                  <SelectItem value="purchase">Purchases</SelectItem>
                  <SelectItem value="refund">Refunds</SelectItem>
                  <SelectItem value="admin_grant">Admin Grants</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="sort-order">Sort</Label>
              <Button
                variant="outline"
                onClick={() =>
                  setSortOrder(sortOrder === "desc" ? "asc" : "desc")
                }
                className="w-full sm:w-auto"
              >
                <Calendar className="h-4 w-4 mr-2" />
                {sortOrder === "desc" ? "Newest First" : "Oldest First"}
                <ArrowUpDown className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>

          {/* Transaction List */}
          <div className="flex-1 overflow-y-auto max-h-[400px] space-y-2">
            {filteredAndSortedTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {transactions.length === 0
                  ? "No transactions yet"
                  : "No transactions match your filters"}
              </div>
            ) : (
              filteredAndSortedTransactions.map((transaction) => (
                <Card
                  key={transaction.id}
                  className="hover:bg-muted/50 transition-colors"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                            transaction.type === "charge"
                              ? "bg-red-100 text-red-600"
                              : "bg-green-100 text-green-600"
                          }`}
                        >
                          {getTransactionIcon(transaction.type)}
                        </div>
                        <div>
                          <div className="font-medium">
                            {transaction.description}
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <Badge
                              variant={
                                TRANSACTION_TYPE_COLORS[transaction.type]
                              }
                              className="text-xs"
                            >
                              {TRANSACTION_TYPE_LABELS[transaction.type]}
                            </Badge>
                            <span>•</span>
                            <span>{formatDate(transaction.createdAt)}</span>
                            {transaction.transactionSignature && (
                              <>
                                <span>•</span>
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="p-0 h-auto text-xs text-muted-foreground hover:text-foreground"
                                  onClick={() =>
                                    openSolanaExplorer(
                                      transaction.transactionSignature!
                                    )
                                  }
                                >
                                  View on Solana Explorer
                                  <ExternalLink className="h-3 w-3 ml-1" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`font-bold ${
                            transaction.type === "charge"
                              ? "text-red-500"
                              : "text-green-500"
                          }`}
                        >
                          {transaction.type === "charge" ? "−" : "+"}
                          {transaction.amount.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          tokens
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>
              Showing {filteredAndSortedTransactions.length} of{" "}
              {transactions.length} transactions
            </span>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
