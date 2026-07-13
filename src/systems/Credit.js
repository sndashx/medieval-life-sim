/**
 * Credit.js
 * Debt, collateral, interest, bankruptcy mechanics
 * Models medieval lending, risk, default, enforcement
 */

export class Credit {
  constructor(kernel = null, game = null) {
    this.kernel = kernel || game?.kernel || null;
    this.game = game || null;
    this.loans = new Map();
    this.collateral = new Map();
    this.defaults = new Map();
    this.nextLoanId = 1;
    this.nextCollateralId = 1;
  }

  issueLoan(lender, borrower, amount, terms) {
    // Validate terms
    if (!terms.duration || !terms.interestRate) {
      return { success: false, reason: 'Invalid loan terms' };
    }
    
    // Check lender has funds
    if (lender.wealth < amount) {
      return { success: false, reason: 'Lender has insufficient funds' };
    }
    
    // Assess creditworthiness
    const creditScore = this.assessCreditworthiness(borrower);
    if (creditScore < 0.3) {
      return { success: false, reason: 'Borrower not creditworthy' };
    }
    
    // Check collateral requirement
    if (terms.collateralRequired && !terms.collateral) {
      return { success: false, reason: 'Collateral required but not provided' };
    }
    
    const loan = {
      id: this.nextLoanId++,
      lender: lender.id,
      borrower: borrower.id,
      principal: amount,
      interestRate: terms.interestRate,
      duration: terms.duration, // days
      issued: this.kernel?.turn ?? 0,
      due: this.kernel?.turn ?? 0 + terms.duration * 24 * 60 * 60 * 1000,
      collateral: terms.collateral || null,
      payments: [],
      balance: amount,
      status: 'active',
      defaulted: false
    };
    
    // Transfer funds
    lender.wealth -= amount;
    borrower.wealth += amount;
    
    // Register collateral if provided
    if (terms.collateral) {
      this.registerCollateral(loan.id, terms.collateral, borrower);
    }
    
    this.loans.set(loan.id, loan);
    
    // Track on both parties
    if (!lender.loansIssued) lender.loansIssued = [];
    if (!borrower.loansTaken) borrower.loansTaken = [];
    
    lender.loansIssued.push(loan.id);
    borrower.loansTaken.push(loan.id);
    
    return {
      success: true,
      loan: loan,
      totalRepayment: this.calculateTotalRepayment(loan)
    };
  }

  assessCreditworthiness(person) {
    let score = 0.5; // Base
    
    // Wealth affects creditworthiness
    if (person.wealth > 1000) score += 0.2;
    else if (person.wealth > 500) score += 0.1;
    else if (person.wealth < 100) score -= 0.2;
    
    // Reputation affects creditworthiness
    if (person.reputation) {
      score += person.reputation * 0.2;
    }
    
    // Past defaults hurt creditworthiness
    if (person.loanDefaults) {
      score -= person.loanDefaults * 0.3;
    }
    
    // Employment/income
    if (person.occupation) {
      score += 0.1;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  calculateTotalRepayment(loan) {
    // Simple interest
    const interest = loan.principal * loan.interestRate * (loan.duration / 365);
    return loan.principal + interest;
  }

  registerCollateral(loanId, collateral, owner) {
    const collateralRecord = {
      id: this.nextCollateralId++,
      loan: loanId,
      owner: owner.id,
      type: collateral.type, // property, goods, livestock, land
      value: collateral.value,
      description: collateral.description,
      seized: false
    };
    
    this.collateral.set(collateralRecord.id, collateralRecord);
    
    const loan = this.loans.get(loanId);
    if (loan) {
      loan.collateralId = collateralRecord.id;
    }
    
    return collateralRecord;
  }

  makePayment(loanId, payer, amount) {
    const loan = this.loans.get(loanId);
    if (!loan) {
      return { success: false, reason: 'Unknown loan' };
    }
    
    if (loan.status !== 'active') {
      return { success: false, reason: 'Loan not active' };
    }
    
    if (payer.id !== loan.borrower) {
      return { success: false, reason: 'Not the borrower' };
    }
    
    if (payer.wealth < amount) {
      return { success: false, reason: 'Insufficient funds' };
    }
    
    // Process payment
    payer.wealth -= amount;
    loan.balance -= amount;
    
    loan.payments.push({
      amount: amount,
      date: this.kernel?.turn ?? 0,
      balance: loan.balance
    });
    
    // Check if fully repaid
    if (loan.balance <= 0) {
      loan.status = 'repaid';
      loan.repaidDate = this.kernel?.turn ?? 0;
      
      // Release collateral
      if (loan.collateralId) {
        const collateral = this.collateral.get(loan.collateralId);
        if (collateral) {
          collateral.released = true;
        }
      }
    }
    
    return {
      success: true,
      remainingBalance: loan.balance,
      fullyRepaid: loan.balance <= 0
    };
  }

  checkDefault(loanId) {
    const loan = this.loans.get(loanId);
    if (!loan) return { defaulted: false };
    
    if (loan.status !== 'active') return { defaulted: false };
    
    const now = this.kernel?.turn ?? 0;
    
    // Check if past due
    if (now > loan.due && loan.balance > 0) {
      return this.processDefault(loanId);
    }
    
    return { defaulted: false };
  }

  processDefault(loanId) {
    const loan = this.loans.get(loanId);
    if (!loan) return { defaulted: false };

    loan.status = 'defaulted';
    loan.defaulted = true;
    loan.defaultDate = this.kernel?.turn ?? 0;

    const defaultRecord = {
      loan: loanId,
      borrower: loan.borrower,
      lender: loan.lender,
      amount: loan.balance,
      date: this.kernel?.turn ?? 0,
      collateralSeized: false
    };

    // T2-7: delegate to explicit seizeCollateral hook for consistency.
    const seized = this.seizeCollateral(loanId);
    if (seized.success) {
      defaultRecord.collateralSeized = true;
      defaultRecord.collateralValue = seized.collateralValue;
      defaultRecord.recovered = seized.recovered;
    }

    this.defaults.set(loanId, defaultRecord);

    // T2-7: track default on the real borrower (kernel-resolved), not a
    // throwaway local — the bug below made defaults invisible.
    const kernel = this.kernel || this.game?.kernel;
    const borrower = kernel?.entities?.get?.(loan.borrower);
    if (borrower) {
      borrower.loanDefaults = (borrower.loanDefaults || 0) + 1;
    }

    return {
      defaulted: true,
      record: defaultRecord,
      collateralSeized: defaultRecord.collateralSeized,
      remainingDebt: loan.balance
    };
  }

  /**
   * T2-7: explicit collateral seizure hook. Marks the collateral as
   * seized, transfers its value to the lender (via `kernel`), and reduces
   * the outstanding loan balance. Returns a summary.
   */
  seizeCollateral(loanId) {
    const loan = this.loans.get(loanId);
    if (!loan) return { success: false, reason: 'Unknown loan' };
    if (!loan.collateralId) return { success: false, reason: 'No collateral registered' };
    const collateral = this.collateral.get(loan.collateralId);
    if (!collateral) return { success: false, reason: 'Collateral record missing' };
    if (collateral.seized) return { success: false, reason: 'Already seized', collateralValue: 0, recovered: 0 };

    collateral.seized = true;
    collateral.seizedDate = this.kernel?.turn ?? 0;
    collateral.seizedFor = loan.id;

    const recovered = Math.min(Math.max(0, loan.balance), Math.max(0, collateral.value || 0));
    loan.balance = Math.max(0, loan.balance - recovered);

    // Transfer recovered funds from borrower → lender via the kernel
    // entity map when possible. Falls back to no-op if either is missing.
    const kernel = this.kernel || this.game?.kernel;
    if (kernel?.entities) {
      const lender = kernel.entities.get(loan.lender);
      const borrower = kernel.entities.get(loan.borrower);
      if (borrower && typeof borrower.wealth === 'number') {
        borrower.wealth = Math.max(0, (borrower.wealth || 0) - recovered);
      }
      if (lender && typeof lender.wealth === 'number' && recovered > 0) {
        lender.wealth = (lender.wealth || 0) + recovered;
      }
    }

    return {
      success: true,
      collateralValue: collateral.value || 0,
      recovered,
      remainingBalance: loan.balance
    };
  }

  /**
   * T2-7: accrue interest across all active loans. Called once per in-game
   * day from Game.advanceTurns. `timeElapsed` defaults to one day in ms.
   */
  accrueAllInterest(timeElapsed = 24 * 60 * 60 * 1000) {
    let totalAccrued = 0;
    let processedLoans = 0;
    for (const [id, loan] of this.loans) {
      if (loan.status !== 'active') continue;
      const r = this.accrueInterest(id, timeElapsed);
      if (r.success) {
        totalAccrued += r.interest;
        processedLoans++;
      }
    }
    return { processedLoans, totalInterest: totalAccrued };
  }

  declareBankruptcy(person) {
    // Check if eligible
    const totalDebt = this.calculateTotalDebt(person.id);
    
    if (totalDebt < person.wealth * 2) {
      return { success: false, reason: 'Not eligible for bankruptcy' };
    }
    
    // Process bankruptcy
    const activeLoans = this.getActiveLoans(person.id);
    const seizedAssets = [];
    
    for (const loanId of activeLoans) {
      const loan = this.loans.get(loanId);
      if (!loan) continue;
      
      // Seize collateral
      if (loan.collateralId) {
        const collateral = this.collateral.get(loan.collateralId);
        if (collateral && !collateral.seized) {
          collateral.seized = true;
          seizedAssets.push(collateral);
        }
      }
      
      // Mark loan as defaulted
      loan.status = 'bankruptcy';
      loan.defaulted = true;
    }
    
    // Seize remaining assets
    const assetValue = person.wealth;
    person.wealth = 0;
    
    // Distribute to creditors proportionally
    const distribution = this.distributeAssets(activeLoans, assetValue + seizedAssets.reduce((sum, a) => sum + a.value, 0));
    
    return {
      success: true,
      loansAffected: activeLoans.length,
      assetsSeized: seizedAssets.length,
      totalValue: assetValue,
      distribution: distribution
    };
  }

  calculateTotalDebt(personId) {
    let total = 0;
    
    for (const loan of this.loans.values()) {
      if (loan.borrower === personId && loan.status === 'active') {
        total += loan.balance;
      }
    }
    
    return total;
  }

  getActiveLoans(personId) {
    const loans = [];
    
    for (const [id, loan] of this.loans) {
      if (loan.borrower === personId && loan.status === 'active') {
        loans.push(id);
      }
    }
    
    return loans;
  }

  distributeAssets(loanIds, totalAssets) {
    const distribution = [];
    let totalDebt = 0;
    
    // Calculate total debt
    for (const loanId of loanIds) {
      const loan = this.loans.get(loanId);
      if (loan) {
        totalDebt += loan.balance;
      }
    }
    
    // Distribute proportionally
    for (const loanId of loanIds) {
      const loan = this.loans.get(loanId);
      if (!loan) continue;
      
      const proportion = loan.balance / totalDebt;
      const amount = totalAssets * proportion;
      
      distribution.push({
        lender: loan.lender,
        amount: amount,
        proportion: proportion
      });
      
      loan.balance -= amount;
    }
    
    return distribution;
  }

  calculateInterest(loanId, timeElapsed) {
    const loan = this.loans.get(loanId);
    if (!loan || loan.status !== 'active') return 0;
    
    // Simple interest calculation
    const daysElapsed = timeElapsed / (24 * 60 * 60 * 1000);
    const interest = loan.balance * loan.interestRate * (daysElapsed / 365);
    
    return interest;
  }

  accrueInterest(loanId, timeElapsed) {
    const loan = this.loans.get(loanId);
    if (!loan || loan.status !== 'active') {
      return { success: false, reason: 'Loan not active' };
    }
    
    const interest = this.calculateInterest(loanId, timeElapsed);
    loan.balance += interest;
    
    return {
      success: true,
      interest: interest,
      newBalance: loan.balance
    };
  }

  renegotiate(loanId, newTerms) {
    const loan = this.loans.get(loanId);
    if (!loan) {
      return { success: false, reason: 'Unknown loan' };
    }
    
    if (loan.status !== 'active') {
      return { success: false, reason: 'Loan not active' };
    }
    
    // Update terms
    if (newTerms.interestRate !== undefined) {
      loan.interestRate = newTerms.interestRate;
    }
    
    if (newTerms.duration !== undefined) {
      loan.duration = newTerms.duration;
      loan.due = this.kernel?.turn ?? 0 + newTerms.duration * 24 * 60 * 60 * 1000;
    }
    
    if (newTerms.payment !== undefined) {
      // Partial payment as part of renegotiation
      loan.balance -= newTerms.payment;
    }
    
    loan.renegotiated = true;
    loan.renegotiationDate = this.kernel?.turn ?? 0;
    
    return {
      success: true,
      newTerms: {
        interestRate: loan.interestRate,
        duration: loan.duration,
        balance: loan.balance
      }
    };
  }

  getLoan(id) {
    return this.loans.get(id);
  }

  getCollateral(id) {
    return this.collateral.get(id);
  }

  getDefault(loanId) {
    return this.defaults.get(loanId);
  }

  getLoansByBorrower(borrowerId) {
    return Array.from(this.loans.values())
      .filter(l => l.borrower === borrowerId);
  }

  getLoansByLender(lenderId) {
    return Array.from(this.loans.values())
      .filter(l => l.lender === lenderId);
  }

  getActiveLoansForPerson(personId) {
    return Array.from(this.loans.values())
      .filter(l => (l.borrower === personId || l.lender === personId) && l.status === 'active');
  }

  getDefaultRate(lenderId) {
    const loans = this.getLoansByLender(lenderId);
    if (loans.length === 0) return 0;
    
    const defaulted = loans.filter(l => l.defaulted).length;
    return defaulted / loans.length;
  }
}
