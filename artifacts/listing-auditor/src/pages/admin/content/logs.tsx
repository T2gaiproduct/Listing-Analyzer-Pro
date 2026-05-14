import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, ClipboardList } from "lucide-react";

interface AuditLog {
  id: number; adminUserId: string; action: string; entity: string; entityId: string | null;
  metadata: object | null; ipAddress: string | null; createdAt: string;
}

function fetchLogs(): Promise<{ logs: AuditLog[] }> {
  return fetch("/api/admin/audit-logs").then((r) => r.json());
}

export default function AdminContentLogs() {
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-audit-logs"], queryFn: fetchLogs });
  const logs = data?.logs ?? [];

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
        <Card className="p-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Entity ID</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : logs.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No audit logs found.</TableCell></TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">#{log.id}</TableCell>
                      <TableCell className="max-w-[160px] truncate">{log.adminUserId}</TableCell>
                      <TableCell><span className="inline-flex items-center gap-1"><ClipboardList className="h-3 w-3 text-orange-500" />{log.action}</span></TableCell>
                      <TableCell className="capitalize">{log.entity}</TableCell>
                      <TableCell className="max-w-[120px] truncate">{log.entityId || "-"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{log.ipAddress || "-"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{new Date(log.createdAt).toLocaleString()}</TableCell>
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
