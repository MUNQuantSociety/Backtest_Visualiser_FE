import { useId, useState, type ReactNode } from 'react';

import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  annuityPresentValue,
  futureValue,
  netPresentValue,
  parseCashFlows,
  presentValue,
  type Calculation,
} from '@/features/calculator';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/format';

const FIELD =
  'tabular h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

const FREQUENCIES = [
  { value: 1, label: 'Yearly', noun: 'every year' },
  { value: 2, label: 'Twice a year', noun: 'twice a year' },
  { value: 4, label: 'Quarterly', noun: 'every quarter' },
  { value: 12, label: 'Monthly', noun: 'every month' },
  { value: 52, label: 'Weekly', noun: 'every week' },
] as const;

/** A typed number, or NaN for an empty or unreadable field. */
const toNumber = (text: string) => (text.trim() === '' ? Number.NaN : Number(text));
const money = (value: number) => formatCurrency(value);

/**
 * Everyday time-value-of-money calculations, after MQSMaster's finance
 * calculator: future value, present value, net present value and the present
 * value of an annuity. Each card recalculates as it is typed in and says what
 * its answer means. Everything runs in the browser; nothing is sent anywhere.
 */
export default function FinancialCalculatorPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Calculator"
        description="Time value of money: what money is worth at a different time, at a given interest rate."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <FutureValueCard />
        <PresentValueCard />
        <NetPresentValueCard />
        <AnnuityCard />
      </div>
    </div>
  );
}

function FutureValueCard() {
  const [amount, setAmount] = useState('1000');
  const [rate, setRate] = useState('5');
  const [years, setYears] = useState('10');
  const result = futureValue(toNumber(amount), toNumber(rate) / 100, toNumber(years));

  return (
    <CalculatorCard
      title="Future value"
      description="What an amount invested today grows to."
      formula="FV = PV × (1 + r)^t"
      result={result}
      explain={(value) =>
        `${money(toNumber(amount))} invested today at ${rate}% a year grows to ${money(value)} in ${years} years.`
      }
    >
      <NumberField label="Amount today ($)" value={amount} onChange={setAmount} />
      <NumberField label="Interest rate (% a year)" value={rate} onChange={setRate} />
      <NumberField label="Years" value={years} onChange={setYears} />
    </CalculatorCard>
  );
}

function PresentValueCard() {
  const [amount, setAmount] = useState('1000');
  const [rate, setRate] = useState('5');
  const [years, setYears] = useState('10');
  const result = presentValue(toNumber(amount), toNumber(rate) / 100, toNumber(years));

  return (
    <CalculatorCard
      title="Present value"
      description="What an amount received in the future is worth today."
      formula="PV = FV ÷ (1 + r)^t"
      result={result}
      explain={(value) =>
        `${money(toNumber(amount))} received in ${years} years is worth ${money(value)} today at ${rate}% a year.`
      }
    >
      <NumberField label="Future amount ($)" value={amount} onChange={setAmount} />
      <NumberField label="Discount rate (% a year)" value={rate} onChange={setRate} />
      <NumberField label="Years" value={years} onChange={setYears} />
    </CalculatorCard>
  );
}

function NetPresentValueCard() {
  const [investment, setInvestment] = useState('1000');
  const [rate, setRate] = useState('10');
  const [flows, setFlows] = useState('400, 500, 600');
  const result = netPresentValue(toNumber(investment), toNumber(rate) / 100, parseCashFlows(flows));
  const flowsId = useId();

  return (
    <CalculatorCard
      title="Net present value (NPV)"
      description="Whether a project is worth more than it costs, in today's money."
      formula="NPV = Σ CFₜ ÷ (1 + r)^t − C₀"
      result={result}
      explain={(value) =>
        value > 0
          ? `Worth doing at ${rate}%: the cash flows are worth ${money(value)} more than the investment.`
          : value < 0
            ? `Not worth it at ${rate}%: the cash flows fall ${money(-value)} short of the investment.`
            : `Break-even at ${rate}%: the cash flows are worth exactly the investment.`
      }
      tone={(value) => (value > 0 ? 'profit' : value < 0 ? 'loss' : 'neutral')}
    >
      <NumberField label="Initial investment ($)" value={investment} onChange={setInvestment} />
      <NumberField label="Discount rate (% a year)" value={rate} onChange={setRate} />
      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor={flowsId} className="text-sm font-medium">
          Cash flows, one per year ($)
        </label>
        <input
          id={flowsId}
          value={flows}
          onChange={(event) => {
            setFlows(event.target.value);
          }}
          placeholder="300, 400, 500"
          className={FIELD}
        />
        <p className="text-xs text-muted-foreground">
          Separate years with commas; the first arrives a year from now. Use a minus sign for a year
          that costs money.
        </p>
      </div>
    </CalculatorCard>
  );
}

function AnnuityCard() {
  const [payment, setPayment] = useState('500');
  const [rate, setRate] = useState('6');
  const [years, setYears] = useState('5');
  const [frequency, setFrequency] = useState<number>(12);
  const frequencyId = useId();
  const result = annuityPresentValue(
    toNumber(payment),
    toNumber(rate) / 100,
    toNumber(years),
    frequency,
  );
  const noun = FREQUENCIES.find((option) => option.value === frequency)?.noun ?? '';

  return (
    <CalculatorCard
      title="Present value of an annuity"
      description="What a series of equal payments is worth today, like a loan or a pension."
      formula="PV = C × (1 − (1 + r/m)^−(m·t)) ÷ (r/m)"
      result={result}
      explain={(value) =>
        `${money(toNumber(payment))} paid ${noun} for ${years} years is worth ${money(value)} today at ${rate}% a year.`
      }
    >
      <NumberField label="Payment ($)" value={payment} onChange={setPayment} />
      <div className="space-y-1.5">
        <label htmlFor={frequencyId} className="text-sm font-medium">
          Paid
        </label>
        <select
          id={frequencyId}
          value={frequency}
          onChange={(event) => {
            setFrequency(Number(event.target.value));
          }}
          className={FIELD}
        >
          {FREQUENCIES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <NumberField label="Interest rate (% a year)" value={rate} onChange={setRate} />
      <NumberField label="Years" value={years} onChange={setYears} />
    </CalculatorCard>
  );
}

const TONES = {
  profit: 'text-[var(--profit)]',
  loss: 'text-[var(--loss)]',
  neutral: 'text-foreground',
} as const;

/** One calculation: its inputs, its answer as a dollar figure, and what that means. */
function CalculatorCard({
  title,
  description,
  formula,
  result,
  explain,
  tone,
  children,
}: {
  title: string;
  description: string;
  formula: string;
  result: Calculation;
  explain: (value: number) => string;
  tone?: (value: number) => keyof typeof TONES;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid items-end gap-3 sm:grid-cols-2">{children}</div>
        <div
          role="status"
          aria-live="polite"
          aria-label={`${title} result`}
          className="space-y-1 rounded-md border border-border bg-background px-4 py-3"
        >
          {result.ok ? (
            <>
              <p
                className={cn(
                  'tabular text-2xl font-semibold',
                  TONES[tone ? tone(result.value) : 'neutral'],
                )}
              >
                {money(result.value)}
              </p>
              <p className="text-sm text-muted-foreground">{explain(result.value)}</p>
            </>
          ) : (
            <p className="text-sm text-[var(--loss)]">{result.problem}</p>
          )}
          <p className="tabular pt-1 text-xs text-muted-foreground">{formula}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step="any"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={FIELD}
      />
    </div>
  );
}
