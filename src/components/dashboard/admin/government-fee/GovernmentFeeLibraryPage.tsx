"use client";
import { useGovernmentFees } from '@/hooks/useGovernmentFees';
import { usePermissions } from '@/hooks/use-permissions';
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Plus, Edit2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import dynamic from 'next/dynamic';

const GovernmentFeeLibraryDialog = dynamic(() => import('./GovernmentFeeLibraryDialog'), {
  ssr: false
});

export default function GovernmentFeeLibraryPage() {
  const { hasPermission } = usePermissions();
  const canView = hasPermission('government_fee.view');
  const canManage = hasPermission('government_fee.manage');

  const { fees, loading: isLoading, fetchFees: fetchLibrary, deleteFee } = useGovernmentFees();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFee, setSelectedFee] = useState<any>(null);
  const { toast } = useToast();

  if (!canView) return <div className="p-8 text-center text-muted-foreground">Access Denied. You do not have permission to view Government Fees.</div>;

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this fee?')) return;
    await deleteFee(id);
  };

  const openDialog = (fee = null) => {
    setSelectedFee(fee);
    setIsDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'scheduled': return <Badge className="bg-blue-100 text-blue-800">Scheduled</Badge>;
      case 'expired': return <Badge className="bg-red-100 text-red-800">Expired</Badge>;
      case 'inactive': return <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="w-full max-w-none space-y-6 pb-12">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur pt-6 pb-4 border-b flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Government Fee Library</h2>
          <p className="text-muted-foreground mt-1">Manage global government fees and their applicability conditions.</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={fetchLibrary} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {canManage && (
            <Button size="sm" onClick={() => openDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Fee
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Fee Name</TableHead>
                <TableHead>Fee Lines</TableHead>
                <TableHead>Validity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : fees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No government fees found.</TableCell>
                </TableRow>
              ) : (
                fees.map((fee: any) => {
                  const conditions = fee.government_fee_applicability_conditions || [];
                  const rules = fee.government_fee_calculation_rules || [];
                  const conditionCount = conditions.length;
                  const rulesCount = rules.length;

                  return (
                    <TableRow key={fee.id}>
                      <TableCell className="font-medium">{fee.fee_name}</TableCell>
                      <TableCell>
                        {rulesCount === 0 && conditionCount === 0 ? (
                          <span className="text-muted-foreground text-sm">No rules configured</span>
                        ) : (
                          <div className="space-y-1">
                            <div className="text-sm font-medium">
                              {conditionCount} condition{conditionCount !== 1 ? 's' : ''} &bull; {rulesCount} rule{rulesCount !== 1 ? 's' : ''}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {rules.slice(0, 2).map((r: any, idx: number) => (
                                <div key={idx} className="truncate max-w-[300px] capitalize">
                                  {r.calculation_type.replace('_', ' ')}: {r.calculation_type === 'fixed' ? `₹${r.fee_amount}` : r.calculation_type === 'percentage' ? `${r.percentage_rate}%` : r.calculation_type === 'formula' ? r.formula_expression : ''}
                                </div>
                              ))}
                              {rulesCount > 2 && (
                                <div className="italic mt-0.5">+{rulesCount - 2} more</div>
                              )}
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                           {fee.effective_from ? new Date(fee.effective_from).toLocaleDateString('en-GB').replace(/\//g, '-') : 'No Start'} to {fee.effective_to ? new Date(fee.effective_to).toLocaleDateString('en-GB').replace(/\//g, '-') : 'No Expiry'}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(fee.computed_status || fee.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openDialog(fee)} title={canManage ? "Edit" : "View"}>
                          {canManage ? <Edit2 className="w-4 h-4" /> : <span className="text-xs font-medium uppercase tracking-wide">View</span>}
                        </Button>
                        {canManage && (
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(fee.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {isDialogOpen && (
        <GovernmentFeeLibraryDialog
          fee={selectedFee}
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onSuccess={() => {
            setIsDialogOpen(false);
            fetchLibrary();
          }}
          formMode={canManage ? 'edit' : 'view'}
        />
      )}
    </div>
  );
}
