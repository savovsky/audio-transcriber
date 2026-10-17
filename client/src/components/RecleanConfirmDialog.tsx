import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';

export interface RecleanConfirmDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

// Session-wide re-clean overwrites manual edits to the cleaned layer — the
// user confirms explicitly (POC_M4, decision 2).
export default function RecleanConfirmDialog({ isOpen, onCancel, onConfirm }: RecleanConfirmDialogProps) {
  return (
    <Dialog open={isOpen} onClose={onCancel}>
      <DialogTitle>Преизчистване на всички блокове</DialogTitle>
      <DialogContent>
        <Typography variant='body2'>
          Всички блокове ще бъдат изчистени наново с избраните стил, модел и температура. Ръчните редакции в
          изчистения текст ще бъдат презаписани. Дословният текст се запазва.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Отказ</Button>
        <Button variant='contained' onClick={onConfirm}>
          Потвърди
        </Button>
      </DialogActions>
    </Dialog>
  );
}
