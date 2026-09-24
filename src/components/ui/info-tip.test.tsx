import { render, screen, userEvent, waitFor } from '@/test/test-utils';

import { InfoTip } from './info-tip';

function Subject() {
  return (
    <div>
      <button type="button">elsewhere</button>
      <InfoTip label="Window">The dates to simulate.</InfoTip>
    </div>
  );
}

describe('InfoTip', () => {
  it('sets its own text style instead of inheriting its label’s', async () => {
    // A table heading is monospace, uppercase and unwrapped; the bubble must
    // still read as wrapped prose.
    render(
      <p className="tabular tracking-[0.06em] whitespace-nowrap uppercase">
        <InfoTip label="RSI 14">Wilder’s 14-session RSI.</InfoTip>
      </p>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'About RSI 14' }));

    expect(screen.getByRole('tooltip')).toHaveClass(
      'font-sans',
      'whitespace-normal',
      'normal-case',
      'tracking-normal',
      'font-normal',
    );
  });

  it('opens on keyboard focus and is what the trigger is described by', async () => {
    render(<Subject />);
    const trigger = screen.getByRole('button', { name: 'About Window' });

    await userEvent.tab();
    await userEvent.tab();

    expect(trigger).toHaveFocus();
    const bubble = await screen.findByRole('tooltip');
    expect(bubble).toHaveTextContent('The dates to simulate.');
    expect(trigger).toHaveAttribute('aria-describedby', bubble.id);
  });

  it('opens on hover and stays while the pointer is over it', async () => {
    render(<Subject />);

    await userEvent.hover(screen.getByRole('button', { name: 'About Window' }));

    expect(await screen.findByRole('tooltip')).toBeInTheDocument();
  });

  it('toggles on click, for touch screens with no hover', async () => {
    render(<Subject />);
    const trigger = screen.getByRole('button', { name: 'About Window' });

    await userEvent.click(trigger);
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    await userEvent.click(trigger);
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('closes on Escape and keeps the key from reaching the dialog', async () => {
    render(<Subject />);
    const trigger = screen.getByRole('button', { name: 'About Window' });
    await userEvent.click(trigger);
    await screen.findByRole('tooltip');
    const seen: KeyboardEvent[] = [];
    document.addEventListener('keydown', (event) => seen.push(event), { capture: false });

    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
    // Stopped at the trigger: the document (where a dialog would listen) never hears it.
    expect(seen.filter((event) => event.key === 'Escape')).toHaveLength(0);
  });

  it('closes on an outside press', async () => {
    render(<Subject />);
    await userEvent.click(screen.getByRole('button', { name: 'About Window' }));
    await screen.findByRole('tooltip');

    await userEvent.click(screen.getByRole('button', { name: 'elsewhere' }));

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });
});
