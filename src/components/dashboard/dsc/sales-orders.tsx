'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useDSCRecords } from '@/hooks/use-dsc-records';
import { fmtDate } from './dsc-utils';

export function SalesOrders() {
    const { orders } = useDSCRecords();

    return (
        <Card>
            <CardHeader>
                <CardTitle>Sales Orders</CardTitle>
            </CardHeader>
            <CardContent>
                {orders.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No sales orders found.</div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Order Date</TableHead>
                                <TableHead>Client / Person</TableHead>
                                <TableHead>Items</TableHead>
                                <TableHead>Total Amount</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {orders.map(order => (
                                <TableRow key={order.id}>
                                    <TableCell>{fmtDate(order.orderDate)}</TableCell>
                                    <TableCell>
                                        <div className="font-medium">{order.clientNameSnapshot || 'Unknown Client'}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">
                                            {order.lines.map((line, idx) => (
                                                <div key={idx} className="text-xs text-muted-foreground">
                                                    {line.description} (x{line.qty})
                                                </div>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell>₹{order.total}</TableCell>
                                    <TableCell>
                                        <Badge variant={order.status === 'Fulfilled' ? 'default' : 'secondary'}>
                                            {order.status}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
