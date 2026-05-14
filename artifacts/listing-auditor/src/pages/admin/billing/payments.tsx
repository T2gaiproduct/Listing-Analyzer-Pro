import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Search, RefreshCw } from "lucide-react";

interface Payment {
  id: number; userId: string; amount: number; currency: string; status: string;
  gateway: string; createdAt: string;
}

function fetchPayments(status: string, gateway: string): Promise<{ payments: Payment[]; total: number }> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (gateway) params.set("gateway", gateway);
  return fetch(`/api/admin/payments?${params.toString()}`).then((r) => r.json());
}

export default function AdminBillingPayments() {
  const [statusFilter, setStatusFilter] = useState("");
  const [gatewayFilter, setGatewayFilter] = useState("");
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-payments", statusFilter, gatewayFilter],
    queryFn: () => fetchPayments(statusFilter, gatewayFilter),
  });

  const payments = data?.payments ?? [];

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Payments</h1>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Total: {data?.total ?? 0}</Badge>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Filter by status..." value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="pl-8" />
            </div>
            <Input placeholder="Gateway (stripe/razorpay/paypal)" value={gatewayFilter} onChange={(e) => setGatewayFilter(e.target.value)} className="max-w-xs" />
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Gateway</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : payments.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No payments found.</TableCell></TableRow>
                ) : (
                  payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>#{p.id}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{p.userId}</TableCell>
                      <TableCell className="font-medium"><DollarSign className="inline h-3.5 w-3.5" />{p.amount.toFixed(2)} {p.currency}</TableCell>
                      <TableCell className="capitalize">{p.gateway}</TableCell>
                      <TableCell><Badge variant={p.status === "completed" ? "default" : p.status === "failed" ? "destructive" : "secondary"}>{p.status}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </>
  );
}
