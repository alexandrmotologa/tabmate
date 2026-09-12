import { useState, useEffect, useCallback } from 'react';
import { GroupResponse, Member } from '../types.js';

export function useGroupData(initialGroupId = 'demo') {
  const [groupId, setGroupId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('groupId') || initialGroupId;
    }
    return initialGroupId;
  });

  const [data, setData] = useState<GroupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active viewing member ID (for computing "You owe" vs "You are owed")
  const [activeMemberId, setActiveMemberId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`tabmate_active_member_${groupId}`);
      if (stored) return stored;
    }
    return '';
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/groups/${groupId}`);
      if (!res.ok) {
        throw new Error(`Failed to load group data (${res.status})`);
      }
      const json: GroupResponse = await res.json();
      setData(json);

      // Set default active member if not set
      setActiveMemberId((prev) => {
        if (prev && json.members.some((m) => m.id === prev)) {
          return prev;
        }
        const firstMember = json.members[0]?.id || '';
        if (typeof window !== 'undefined' && firstMember) {
          localStorage.setItem(`tabmate_active_member_${groupId}`, firstMember);
        }
        return firstMember;
      });
    } catch (err: any) {
      setError(err.message || 'An error occurred loading group');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const switchActiveMember = (memberId: string) => {
    setActiveMemberId(memberId);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`tabmate_active_member_${groupId}`, memberId);
    }
  };

  const addExpense = async (payload: {
    title: string;
    amount: number;
    currency: string;
    paidByMemberId: string;
    category: string;
    splitType: 'equal' | 'custom' | 'shares' | 'percentage';
    notes?: string;
    splits: { memberId: string; amount?: number; shareCount?: number }[];
  }) => {
    const res = await fetch(`/api/groups/${groupId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to add expense');
    }

    await fetchData();
  };

  const deleteExpense = async (expenseId: string) => {
    const res = await fetch(`/api/groups/${groupId}/expenses/${expenseId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error('Failed to delete expense');
    }
    await fetchData();
  };

  const settleDebt = async (
    fromMemberId: string,
    toMemberId: string,
    amount: number,
    paymentMethod = 'revolut',
    notes?: string
  ) => {
    const res = await fetch(`/api/groups/${groupId}/settlements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromMemberId, toMemberId, amount, paymentMethod, notes }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to record settlement');
    }

    await fetchData();
  };

  const deleteSettlement = async (settlementId: string) => {
    const res = await fetch(`/api/groups/${groupId}/settlements/${settlementId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error('Failed to undo settlement');
    }
    await fetchData();
  };

  const addMember = async (memberData: {
    name: string;
    revolutHandle?: string;
    paypalHandle?: string;
    monzoHandle?: string;
    iban?: string;
  }): Promise<Member> => {
    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memberData),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to add member');
    }

    const { member } = await res.json();
    await fetchData();
    return member;
  };

  const updatePaymentHandles = async (
    memberId: string,
    handles: {
      revolutHandle?: string;
      paypalHandle?: string;
      monzoHandle?: string;
      iban?: string;
    }
  ) => {
    const res = await fetch(`/api/groups/${groupId}/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(handles),
    });

    if (!res.ok) {
      throw new Error('Failed to update payment details');
    }

    await fetchData();
  };

  return {
    groupId,
    setGroupId,
    data,
    loading,
    error,
    activeMemberId,
    switchActiveMember,
    addExpense,
    deleteExpense,
    settleDebt,
    deleteSettlement,
    addMember,
    updatePaymentHandles,
    refresh: fetchData,
  };
}
