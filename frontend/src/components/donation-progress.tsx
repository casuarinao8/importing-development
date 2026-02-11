import { LinearProgress } from "@mui/material";

interface ProgressProps {
  goal: number;
  received: number;
}

export default function DonationProgress(props: ProgressProps) {
  const MIN = 0;
  const MAX = props.goal;
  // Function to normalise the values (MIN / MAX could be integrated)
  const normalise = (value: number) => ((value - MIN) * 100) / (MAX - MIN);

  return <div>
    <LinearProgress variant="determinate" value={normalise(props.received)} />
  </div>
}