// Payment input and precision rules are identical for purchases and sales.
// Storage, parent locks and side effects remain in their respective services.
export { CreatePurchasePaymentDto as CreateSalePaymentDto, validatePayment as validateSalePayment } from '../../purchases/dto/create-purchase-payment.dto.js';
