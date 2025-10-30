import React from 'react';

interface DataRoomAppLayoutProps {
  children: React.ReactNode;
}

export const DataRoomAppLayout: React.FC<DataRoomAppLayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen">
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
};
