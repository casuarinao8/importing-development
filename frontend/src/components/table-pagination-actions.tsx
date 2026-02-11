import { FirstPage, KeyboardArrowLeft, KeyboardArrowRight, LastPage } from '@mui/icons-material';
import { Box, IconButton } from '@mui/material';
import { TablePaginationActionsProps } from '@mui/material/TablePagination/TablePaginationActions';

export default function TablePaginationActions(props: TablePaginationActionsProps) {
  const { count, page, rowsPerPage, onPageChange } = props;

  const handleFirstPageButtonClick = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    onPageChange(event, 0);
  };

  const handleBackButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => onPageChange(event, page - 1);

  const handleNextButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => onPageChange(event, page + 1);

  const handleLastPageButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => onPageChange(event, Math.max(0, Math.ceil(count / rowsPerPage) - 1));

  return <Box sx={{ flexShrink: 0, ml: 2.5 }}>
    <IconButton onClick={handleFirstPageButtonClick} disabled={!page}>
      < FirstPage />
    </IconButton>
    <IconButton onClick={handleBackButtonClick} disabled={!page}>
      < KeyboardArrowLeft />
    </IconButton>
    <IconButton onClick={handleNextButtonClick} disabled={page >= Math.ceil(count / rowsPerPage) - 1}>
      < KeyboardArrowRight />
    </IconButton>
    <IconButton onClick={handleLastPageButtonClick} disabled={page >= Math.ceil(count / rowsPerPage) - 1}>
      <LastPage />
    </IconButton>
  </Box>
}
