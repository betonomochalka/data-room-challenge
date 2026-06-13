import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { Company } from '../../pages/Company';

describe('Company Page', () => {
  it('shows the LeadBox AI offer and valuation model', () => {
    render(<Company />);

    expect(screen.getByText('LeadBox AI')).toBeInTheDocument();
    expect(screen.getByText(/Turn every client conversation into a secure sales room/i)).toBeInTheDocument();
    expect(screen.getByText('$1.2M valuation target')).toBeInTheDocument();
    expect(screen.getByText(/100 paying workspaces at \$99 per month/i)).toBeInTheDocument();
  });
});
