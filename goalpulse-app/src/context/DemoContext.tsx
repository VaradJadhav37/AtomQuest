import React, { createContext, useContext, useState } from 'react';

export type Role = 'EMPLOYEE' | 'MANAGER' | 'ADMIN';

interface DemoContextType {
  role: Role;
  setRole: (role: Role) => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>('EMPLOYEE');
  return (
    <DemoContext.Provider value={{ role, setRole }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error('useDemo must be used within DemoProvider');
  return context;
}
