import { render, screen, fireEvent } from '@testing-library/react';
import Home from '@/app/page';
import { getSession } from '@/lib/authClient';

jest.mock('@/lib/authClient');
const pushMock = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: jest.fn() }),
}));

describe('Home Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders category chips', () => {
    render(<Home />);
    expect(screen.getByText('Kirana')).toBeInTheDocument();
    expect(screen.getByText('Dairy')).toBeInTheDocument();
    expect(screen.getByText('Medical Shop')).toBeInTheDocument();
    expect(screen.getByText('Garments')).toBeInTheDocument();
    expect(screen.getByText('Flowers')).toBeInTheDocument();
  });

  it('renders nearby shops with a call button', () => {
    render(<Home />);
    expect(screen.getByText('Sharma Kirana Store')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Call/ }).length).toBeGreaterThan(0);
  });

  it('filters the shop list by category', () => {
    render(<Home />);
    fireEvent.click(screen.getByText('Medical Shop'));
    expect(screen.getByText('Apollo Medical Store')).toBeInTheDocument();
    expect(screen.queryByText('Sharma Kirana Store')).not.toBeInTheDocument();
  });

  it('does not call when a shop is closed', () => {
    render(<Home />);
    const closedButton = screen.getByRole('button', { name: /Opens 10 AM/ });
    expect(closedButton).toBeDisabled();
  });

  it('sends an unauthenticated customer to phone verification on call', () => {
    (getSession as jest.Mock).mockReturnValue(null);
    render(<Home />);
    fireEvent.click(screen.getByRole('button', { name: /Call Sharma Kirana Store/ }));
    expect(pushMock).toHaveBeenCalledWith('/auth/phone');
  });
});
