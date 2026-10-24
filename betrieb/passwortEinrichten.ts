import { istEingerichtet, legePasswortAn } from '../server/features/zugang/zugang.ts';

const passwort = process.env.ASCEND_NEUES_PASSWORT ?? '';
if (istEingerichtet()) {
  console.log('bereits');
} else {
  legePasswortAn(passwort);
  console.log('festgelegt');
}
